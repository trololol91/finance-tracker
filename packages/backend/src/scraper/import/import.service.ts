import {
    Injectable, NotFoundException, BadRequestException, Logger
} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import {
    TransactionType, FileType
} from '#generated/prisma/client.js';
import {ImportJobResponseDto} from '#scraper/import/import-job-response.dto.js';
import Papa from 'papaparse';
import {parse as parseOfx} from 'ofx';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface CsvRow {
    date?: string;
    description?: string;
    amount?: string;
    type?: string;
}

interface ParsedTransaction {
    date: Date;
    description: string;
    amount: number;
    transactionType: TransactionType;
    fitid: string | null;
}

@Injectable()
export class ImportService {
    private readonly logger = new Logger(ImportService.name);

    constructor(private readonly prisma: PrismaService) {}

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Parse an uploaded CSV or OFX file and bulk-insert transactions.
     * Returns the completed ImportJob record.
     */
    public async upload(
        userId: string,
        file: Express.Multer.File,
        accountId?: string
    ): Promise<ImportJobResponseDto> {
        // Validate file size (guard against Multer misconfiguration)
        if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException('File exceeds the 5 MB size limit');
        }

        // Detect file type
        const fileType = this.detectFileType(file);

        // Validate accountId ownership if provided
        if (accountId) {
            const account = await this.prisma.account.findFirst({where: {id: accountId, userId}});
            if (!account) {
                throw new NotFoundException(`Account with ID ${accountId} not found`);
            }
        }

        // Create the ImportJob record (status = processing immediately for sync MVP)
        const job = await this.prisma.importJob.create({
            data: {
                userId,
                accountId: accountId ?? null,
                filename: file.originalname,
                fileType,
                status: 'processing',
                source: 'file'
            }
        });

        try {
            const content = file.buffer.toString('utf8');
            const {rowCount, importedCount, skippedCount} = await this.parseAndInsert(
                content,
                fileType,
                userId,
                accountId ?? null
            );

            const updated = await this.prisma.importJob.update({
                where: {id: job.id},
                data: {status: 'completed', rowCount, importedCount, skippedCount}
            });

            return ImportJobResponseDto.fromEntity(updated);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (!(err instanceof BadRequestException) && !(err instanceof NotFoundException)) {
                this.logger.error(`Import job ${job.id} failed`, (err as Error).stack);
            }
            const failed = await this.prisma.importJob.update({
                where: {id: job.id},
                data: {status: 'failed', errorMessage}
            });
            return ImportJobResponseDto.fromEntity(failed);
        }
    }

    /**
     * List all import jobs for the given user, newest first.
     */
    public async findAll(userId: string): Promise<ImportJobResponseDto[]> {
        const jobs = await this.prisma.importJob.findMany({
            where: {userId},
            orderBy: {createdAt: 'desc'}
        });
        return jobs.map(j => ImportJobResponseDto.fromEntity(j));
    }

    /**
     * Get a single import job.
     * Throws NotFoundException if not found or belongs to another user.
     */
    public async findOne(userId: string, id: string): Promise<ImportJobResponseDto> {
        const job = await this.prisma.importJob.findFirst({where: {id, userId}});
        if (!job) {
            throw new NotFoundException(`Import job with ID ${id} not found`);
        }
        return ImportJobResponseDto.fromEntity(job);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private detectFileType(file: Express.Multer.File): FileType {
        const name = file.originalname.toLowerCase();
        if (name.endsWith('.ofx') || file.mimetype === 'application/x-ofx') {
            return FileType.ofx;
        }
        if (name.endsWith('.csv') || file.mimetype === 'text/csv' || file.mimetype === 'application/csv') {
            return FileType.csv;
        }
        throw new BadRequestException(
            `Unsupported file type "${file.originalname}". Only CSV and OFX files are accepted.`
        );
    }

    private async parseAndInsert(
        content: string,
        fileType: FileType,
        userId: string,
        accountId: string | null
    ): Promise<{rowCount: number, importedCount: number, skippedCount: number}> {
        const rows =
            fileType === FileType.csv ? this.parseCsv(content) : this.parseOfx(content);

        if (rows.length === 0) {
            return {rowCount: 0, importedCount: 0, skippedCount: 0};
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const row of rows) {
            const isDuplicate = await this.isDuplicate(userId, accountId, row);
            if (isDuplicate) {
                skippedCount++;
                continue;
            }

            try {
                await this.prisma.transaction.create({
                    data: {
                        userId,
                        accountId,
                        description: row.description,
                        amount: row.amount,
                        transactionType: row.transactionType,
                        date: row.date,
                        originalDate: row.date,
                        fitid: row.fitid
                    }
                });
                importedCount++;
            } catch (err) {
                if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                    // Race condition — another insert beat us; treat as duplicate
                    skippedCount++;
                } else {
                    throw err;
                }
            }
        }

        return {rowCount: rows.length, importedCount, skippedCount};
    }

    /**
     * Two-tier deduplication:
     * 1. fitid exact match (OFX FITID or scraper syntheticId)
     * 2. (userId, accountId, date, amount, description) tuple
     */
    private async isDuplicate(
        userId: string,
        accountId: string | null,
        row: ParsedTransaction
    ): Promise<boolean> {
        if (row.fitid) {
            const existing = await this.prisma.transaction.findFirst({
                where: {userId, fitid: row.fitid}
            });
            if (existing) return true;
        }

        // Fallback: composite natural key (best-effort for CSV without FITID)
        const existing = await this.prisma.transaction.findFirst({
            where: {
                userId,
                accountId,
                date: row.date,
                amount: row.amount,
                description: row.description
            }
        });
        return !!existing;
    }

    // -------------------------------------------------------------------------
    // Parsers
    // -------------------------------------------------------------------------

    /**
     * Parse CSV content.
     * Expected header: date,description,amount,type
     * Date format: ISO 8601 (YYYY-MM-DD or full datetime)
     * Type: income | expense | transfer (case-insensitive; defaults to expense)
     */
    private parseCsv(content: string): ParsedTransaction[] {
        const result = Papa.parse<CsvRow>(content, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h: string) => h.trim().toLowerCase()
        });

        if (result.errors.length > 0 && result.data.length === 0) {
            throw new BadRequestException(
                `CSV parse error: ${result.errors[0]?.message ?? 'unknown error'}`
            );
        }


        // Validate required headers are present (catches files uploaded without a header row)
        const fields = (result.meta.fields ?? []) as string[];
        const REQUIRED_HEADERS = ['date', 'description', 'amount'];
        const missingHeaders = REQUIRED_HEADERS.filter(h => !fields.includes(h));
        if (missingHeaders.length > 0) {
            throw new BadRequestException(
                `CSV is missing required column(s): ${missingHeaders.join(', ')}. Expected header row: date,description,amount,type`
            );
        }
        const rows: ParsedTransaction[] = [];
        for (const row of result.data) {
            if (!row.date || !row.description || row.amount === undefined) {
                continue; // Skip incomplete rows
            }
            const dateMs = Date.parse(row.date);
            if (isNaN(dateMs)) continue;

            const amount = parseFloat(row.amount);
            if (isNaN(amount)) continue;

            rows.push({
                date: new Date(dateMs),
                description: row.description.trim(),
                amount,
                transactionType: this.parseTransactionType(row.type, amount),
                fitid: null
            });
        }
        return rows;
    }

    /**
     * Parse OFX content and extract STMTTRN elements.
     * Supports both BANKMSGSRSV1 (chequing/savings) and CREDITCARDMSGSRSV1 (credit card).
     */
    private parseOfx(content: string): ParsedTransaction[] {
        // The ofx package has `any` types — use explicit cast chain to satisfy ESLint
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawParsed = (parseOfx as (c: string) => any)(content) as Record<string, unknown>;
        const ofx = (rawParsed.OFX as Record<string, unknown> | undefined) ?? {};
        const stmtTrns = this.extractStmtTrns(ofx);

        return stmtTrns.map(trn => {
            const amount = parseFloat(this.ofxField(trn, 'TRNAMT') || '0');
            const dateStr = this.ofxField(trn, 'DTPOSTED');
            const date = this.parseOfxDate(dateStr);
            const description = (
                this.ofxField(trn, 'NAME') ||
                this.ofxField(trn, 'MEMO')
            ).trim();
            const rawFitid = this.ofxField(trn, 'FITID');
            const fitid = rawFitid ? rawFitid.trim() : null;

            return {
                date,
                description: description || 'Unknown',
                amount,
                transactionType: amount >= 0 ? TransactionType.income : TransactionType.expense,
                fitid
            };
        });
    }

    /**
     * Safely read a string field from a parsed OFX STMTTRN record.
     * OFX values are always scalars (string | number) inside a `Record<string, unknown>`.
     */
    private ofxField(trn: Record<string, unknown>, key: string): string {
        const v = trn[key];
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v;
        /* v8 ignore next 2 */
        if (typeof v === 'number') return String(v);
        return '';
    }

    /**
     * Walks the parsed OFX object to find STMTTRN records.
     * Handles both bank statements (BANKMSGSRSV1) and credit card (CREDITCARDMSGSRSV1).
     * STMTTRN may be a single object or an array when multiple transactions are present.
     */
    private extractStmtTrns(ofx: Record<string, unknown>): Record<string, unknown>[] {
        const paths: string[][] = [
            ['BANKMSGSRSV1', 'STMTTRNRS', 'STMTRS', 'BANKTRANLIST', 'STMTTRN'],
            ['CREDITCARDMSGSRSV1', 'CCSTMTTRNRS', 'CCSTMTRS', 'BANKTRANLIST', 'STMTTRN']
        ];

        for (const path of paths) {
            const result = this.walkOfxPath(ofx, path);
            if (result !== null) return result;
        }
        return [];
    }

    /** Safely walk a nested Record<string, unknown> tree along a key path. */
    private walkOfxPath(
        root: Record<string, unknown>,
        path: string[]
    ): Record<string, unknown>[] | null {
        let current: unknown = root;
        for (const key of path) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return null;
            }
            current = (current as Record<string, unknown>)[key];
        }
        if (current === null || current === undefined) return null;
        if (Array.isArray(current)) return current as Record<string, unknown>[];
        return [current as Record<string, unknown>];
    }

    /** Parse an OFX date string (YYYYMMDDHHMMSS[.mmm][TZ]) to a Date (UTC). */
    private parseOfxDate(dateStr: string): Date {
        // Take first 8 chars: YYYYMMDD
        const s = dateStr.replace(/[^0-9]/g, '').padEnd(14, '0');
        const year = parseInt(s.slice(0, 4), 10);
        const month = parseInt(s.slice(4, 6), 10) - 1;
        const day = parseInt(s.slice(6, 8), 10);
        const hour = parseInt(s.slice(8, 10), 10);
        const minute = parseInt(s.slice(10, 12), 10);
        const second = parseInt(s.slice(12, 14), 10);
        return new Date(Date.UTC(year, month, day, hour, minute, second));
    }

    private parseTransactionType(type: string | undefined, amount: number): TransactionType {
        const t = (type ?? '').trim().toLowerCase();
        if (t === 'income') return TransactionType.income;
        if (t === 'transfer') return TransactionType.transfer;
        if (t === 'expense') return TransactionType.expense;
        // Fall back to sign of amount
        return amount >= 0 ? TransactionType.income : TransactionType.expense;
    }
}
