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

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Columns that must be present in a CSV header row before any data rows are parsed. */
const REQUIRED_CSV_HEADERS = ['date', 'description', 'amount'] as const;

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
     * Parse an uploaded CSV file and bulk-insert transactions.
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
        if (name.endsWith('.csv') || file.mimetype === 'text/csv' || file.mimetype === 'application/csv') {
            return FileType.csv;
        }
        throw new BadRequestException(
            `Unsupported file type "${file.originalname}". Only CSV files are accepted.`
        );
    }

    private async parseAndInsert(
        content: string,
        userId: string,
        accountId: string | null
    ): Promise<{rowCount: number, importedCount: number, skippedCount: number}> {
        const rows = this.parseCsv(content);

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
     * 1. fitid exact match (bank-assigned FITID or scraper syntheticId)
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
        const fields = (result.meta.fields ?? []);
        const missingHeaders = REQUIRED_CSV_HEADERS.filter(h => !fields.includes(h));
        if (missingHeaders.length > 0) {
            throw new BadRequestException(
                `CSV is missing required column(s): ${missingHeaders.join(', ')}. Required columns: date, description, amount`
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

    private parseTransactionType(type: string | undefined, amount: number): TransactionType {
        const t = (type ?? '').trim().toLowerCase();
        if (t === 'income') return TransactionType.income;
        if (t === 'transfer') return TransactionType.transfer;
        if (t === 'expense') return TransactionType.expense;
        // Fall back to sign of amount
        return amount >= 0 ? TransactionType.income : TransactionType.expense;
    }
}
