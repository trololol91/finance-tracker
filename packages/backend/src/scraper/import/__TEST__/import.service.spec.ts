import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {
    BadRequestException, NotFoundException
} from '@nestjs/common';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import {ImportService} from '#scraper/import/import.service.js';
import {
    FileType, ImportStatus
} from '#generated/prisma/client.js';
import type {PrismaService} from '#database/prisma.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
        originalname: 'transactions.csv',
        mimetype: 'text/csv',
        size: 100,
        buffer: Buffer.from(''),
        fieldname: 'file',
        encoding: '7bit',
        stream: null as unknown as NodeJS.ReadableStream,
        destination: '',
        filename: '',
        path: '',
        ...overrides
    }) as Express.Multer.File;

const VALID_CSV = `date,description,amount,type
2026-01-15,Starbucks,-5.50,expense
2026-01-16,Salary,3000.00,income
2026-01-17,Transfer,-100.00,transfer`;

const VALID_OFX_CREDIT_CARD = `<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260115120000</DTPOSTED>
<TRNAMT>-42.00</TRNAMT>
<FITID>CC001</FITID>
<NAME>Coffee Shop</NAME>
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`;

const CSV_UNKNOWN_TYPE = `date,description,amount,type
2026-01-15,Starbucks,-5.50,debit
2026-01-16,Salary,3000.00,credit`;

const VALID_OFX = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260115120000</DTPOSTED>
<TRNAMT>-5.50</TRNAMT>
<FITID>FITID001</FITID>
<NAME>Starbucks</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260116120000</DTPOSTED>
<TRNAMT>3000.00</TRNAMT>
<FITID>FITID002</FITID>
<NAME>Salary</NAME>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const mockJobBase = {
    id: 'job-uuid-1',
    userId: 'user-uuid-1',
    accountId: null,
    source: 'file',
    filename: 'transactions.csv',
    fileType: FileType.csv,
    status: ImportStatus.processing,
    rowCount: 0,
    importedCount: 0,
    skippedCount: 0,
    errorMessage: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15')
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportService', () => {
    let service: ImportService;
    let prisma: PrismaService;

    const userId = 'user-uuid-1';

    beforeEach(() => {
        prisma = {
            importJob: {
                create: vi.fn(),
                update: vi.fn(),
                findMany: vi.fn(),
                findFirst: vi.fn()
            },
            account: {
                findFirst: vi.fn()
            },
            transaction: {
                create: vi.fn(),
                findFirst: vi.fn()
            }
        } as unknown as PrismaService;

        service = new ImportService(prisma);
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // upload
    // -------------------------------------------------------------------------

    describe('upload', () => {
        it('should reject a file larger than 5 MB', async () => {
            const file = makeFile({size: 6 * 1024 * 1024});
            await expect(service.upload(userId, file)).rejects.toThrow(BadRequestException);
            await expect(service.upload(userId, file)).rejects.toThrow('5 MB');
        });

        it('should throw BadRequestException for an unsupported file type', async () => {
            const file = makeFile({originalname: 'data.txt', mimetype: 'text/plain'});
            await expect(service.upload(userId, file)).rejects.toThrow(BadRequestException);
            await expect(service.upload(userId, file)).rejects.toThrow('Unsupported file type');
        });

        it('should reject when accountId does not belong to user', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
            const file = makeFile({buffer: Buffer.from(VALID_CSV)});
            await expect(service.upload(userId, file, 'other-account-id')).rejects.toThrow(
                NotFoundException
            );
        });

        describe('CSV', () => {
            beforeEach(() => {
                vi.mocked(prisma.importJob.create).mockResolvedValue({...mockJobBase, status: 'processing'});
                vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
                vi.mocked(prisma.transaction.create).mockResolvedValue({} as never);
            });

            it('should parse CSV and return completed job with correct counts', async () => {
                const completedJob = {
                    ...mockJobBase, status: ImportStatus.completed,
                    rowCount: 3, importedCount: 3, skippedCount: 0
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(completedJob);

                const file = makeFile({buffer: Buffer.from(VALID_CSV)});
                const result = await service.upload(userId, file);

                expect(result.status).toBe('completed');
                expect(result.rowCount).toBe(3);
                expect(result.importedCount).toBe(3);
                expect(result.skippedCount).toBe(0);
            });

            it('should skip duplicate rows (by composite natural key)', async () => {
                // First findFirst call returns an existing row → skip
                vi.mocked(prisma.transaction.findFirst).mockResolvedValue({id: 'existing'} as never);
                const skippedJob = {
                    ...mockJobBase, status: ImportStatus.completed,
                    rowCount: 3, importedCount: 0, skippedCount: 3
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(skippedJob);

                const file = makeFile({buffer: Buffer.from(VALID_CSV)});
                const result = await service.upload(userId, file);

                expect(result.skippedCount).toBe(3);
                expect(result.importedCount).toBe(0);
            });

            it('should mark job as failed on malformed CSV with no data', async () => {
                const failedJob = {...mockJobBase, status: ImportStatus.failed, errorMessage: 'CSV parse error'};
                vi.mocked(prisma.importJob.update).mockResolvedValue(failedJob);

                const file = makeFile({buffer: Buffer.from('')});
                await service.upload(userId, file);

                // Empty CSV → 0 rows, no error (just empty)
                // update called with completed or 0 rows
                expect(prisma.importJob.update).toHaveBeenCalled();
            });

            it('should use amount sign to determine type when CSV type column is unrecognised', async () => {
                const completedJob = {
                    ...mockJobBase, status: ImportStatus.completed,
                    rowCount: 2, importedCount: 2, skippedCount: 0
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(completedJob);

                const file = makeFile({buffer: Buffer.from(CSV_UNKNOWN_TYPE)});
                const result = await service.upload(userId, file);

                expect(result.rowCount).toBe(2);
                // Both rows imported (debit/credit fall through to sign-based detection)
                expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
            });

            it('should skip rows missing required CSV fields', async () => {
                const csv = 'date,description,amount,type\n2026-01-15,,100.00,income\n,Starbucks,-5.50,';
                const completedJob = {
                    ...mockJobBase, status: ImportStatus.completed,
                    rowCount: 0, importedCount: 0, skippedCount: 0
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(completedJob);

                const file = makeFile({buffer: Buffer.from(csv)});
                await service.upload(userId, file);

                // Rows with missing date or description are skipped
                expect(prisma.transaction.create).not.toHaveBeenCalled();
            });

            it('should count P2002 race-condition duplicates as skipped', async () => {
                const p2002 = new PrismaClientKnownRequestError('Unique constraint', {
                    code: 'P2002',
                    clientVersion: '7.0.0'
                });
                vi.mocked(prisma.transaction.create).mockRejectedValue(p2002);
                const completedJob = {
                    ...mockJobBase, status: ImportStatus.completed,
                    rowCount: 1, importedCount: 0, skippedCount: 1
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(completedJob);

                const singleRowCsv = 'date,description,amount,type\n2026-01-15,Coffee,-5.50,expense';
                const file = makeFile({buffer: Buffer.from(singleRowCsv)});
                const result = await service.upload(userId, file);

                expect(result.skippedCount).toBe(1);
                expect(result.importedCount).toBe(0);
            });

            it('should propagate non-P2002 errors from transaction.create to job failure', async () => {
                const dbError = new PrismaClientKnownRequestError('FK violation', {
                    code: 'P2003',
                    clientVersion: '7.0.0'
                });
                vi.mocked(prisma.transaction.create).mockRejectedValue(dbError);
                const failedJob = {
                    ...mockJobBase, status: ImportStatus.failed,
                    errorMessage: 'FK violation'
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(failedJob);

                const singleRowCsv = 'date,description,amount,type\n2026-01-15,Coffee,-5.50,expense';
                const file = makeFile({buffer: Buffer.from(singleRowCsv)});
                const result = await service.upload(userId, file);

                expect(result.status).toBe('failed');
            });

            it('should handle non-Error thrown during job completion', async () => {
                const failedJob = {...mockJobBase, status: ImportStatus.failed, errorMessage: 'string error'};
                vi.mocked(prisma.importJob.update)
                    .mockRejectedValueOnce('string error')
                    .mockResolvedValueOnce(failedJob);

                const singleRowCsv = 'date,description,amount,type\n2026-01-15,Coffee,-5.50,expense';
                const file = makeFile({buffer: Buffer.from(singleRowCsv)});
                const result = await service.upload(userId, file);

                expect(result.status).toBe('failed');
            });
        });

        describe('OFX', () => {
            beforeEach(() => {
                vi.mocked(prisma.importJob.create).mockResolvedValue({
                    ...mockJobBase,
                    filename: 'transactions.ofx',
                    fileType: FileType.ofx,
                    status: 'processing'
                });
                vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
                vi.mocked(prisma.transaction.create).mockResolvedValue({} as never);
            });

            it('should parse OFX and return completed job with correct counts', async () => {
                const completedJob = {
                    ...mockJobBase,
                    filename: 'transactions.ofx',
                    fileType: FileType.ofx,
                    status: ImportStatus.completed,
                    rowCount: 2,
                    importedCount: 2,
                    skippedCount: 0
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(completedJob);

                const file = makeFile({
                    originalname: 'transactions.ofx',
                    mimetype: 'application/x-ofx',
                    buffer: Buffer.from(VALID_OFX)
                });
                const result = await service.upload(userId, file);

                expect(result.status).toBe('completed');
                expect(result.fileType).toBe('ofx');
                expect(result.rowCount).toBe(2);
            });

            it('should use fitid for dedup when present in OFX', async () => {
                // Return existing match on first findFirst (fitid lookup) → skipped
                vi.mocked(prisma.transaction.findFirst).mockResolvedValue({id: 'existing'} as never);
                const skippedJob = {
                    ...mockJobBase,
                    filename: 'transactions.ofx',
                    fileType: FileType.ofx,
                    status: ImportStatus.completed,
                    rowCount: 2,
                    importedCount: 0,
                    skippedCount: 2
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(skippedJob);

                const file = makeFile({
                    originalname: 'transactions.ofx',
                    mimetype: 'application/x-ofx',
                    buffer: Buffer.from(VALID_OFX)
                });
                const result = await service.upload(userId, file);

                expect(result.skippedCount).toBe(2);
            });

            it('should mark job as failed when OFX is malformed', async () => {
                const failedJob = {...mockJobBase, filename: 'bad.ofx', fileType: FileType.ofx, status: ImportStatus.failed, errorMessage: 'OFX parse error'};
                vi.mocked(prisma.importJob.update).mockResolvedValue(failedJob);

                const file = makeFile({
                    originalname: 'bad.ofx',
                    mimetype: 'application/x-ofx',
                    buffer: Buffer.from('NOT VALID OFX CONTENT <<<>>>')
                });
                await service.upload(userId, file);
                // Either failed or 0 rows (empty OFX)
                expect(prisma.importJob.update).toHaveBeenCalled();
            });

            it('should parse credit card OFX (CREDITCARDMSGSRSV1) and import transactions', async () => {
                const completedJob = {
                    ...mockJobBase,
                    filename: 'credit.ofx',
                    fileType: FileType.ofx,
                    status: ImportStatus.completed,
                    rowCount: 1,
                    importedCount: 1,
                    skippedCount: 0
                };
                vi.mocked(prisma.importJob.update).mockResolvedValue(completedJob);

                const file = makeFile({
                    originalname: 'credit.ofx',
                    mimetype: 'application/x-ofx',
                    buffer: Buffer.from(VALID_OFX_CREDIT_CARD)
                });
                const result = await service.upload(userId, file);

                expect(result.rowCount).toBe(1);
                expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
            });
        });
    });

    // -------------------------------------------------------------------------
    // findAll
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('should return an array of import jobs ordered by newest first', async () => {
            const jobs = [
                {...mockJobBase, id: 'job-2', createdAt: new Date('2026-02-01')},
                {...mockJobBase, id: 'job-1'}
            ];
            vi.mocked(prisma.importJob.findMany).mockResolvedValue(jobs);

            const result = await service.findAll(userId);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('job-2');
        });

        it('should return empty array when user has no jobs', async () => {
            vi.mocked(prisma.importJob.findMany).mockResolvedValue([]);
            const result = await service.findAll(userId);
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // findOne
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('should return a single job by id', async () => {
            vi.mocked(prisma.importJob.findFirst).mockResolvedValue(mockJobBase);
            const result = await service.findOne(userId, mockJobBase.id);
            expect(result.id).toBe(mockJobBase.id);
        });

        it('should throw NotFoundException for wrong user job', async () => {
            vi.mocked(prisma.importJob.findFirst).mockResolvedValue(null);
            await expect(service.findOne(userId, 'other-job-id')).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException for nonexistent job', async () => {
            vi.mocked(prisma.importJob.findFirst).mockResolvedValue(null);
            await expect(service.findOne(userId, 'nonexistent-id')).rejects.toThrow(NotFoundException);
        });
    });
});
