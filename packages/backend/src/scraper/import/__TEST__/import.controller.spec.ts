import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {BadRequestException} from '@nestjs/common';
import {ImportController} from '#scraper/import/import.controller.js';
import type {ImportService} from '#scraper/import/import.service.js';
import {FileType} from '#generated/prisma/client.js';
import type {ImportJobResponseDto} from '#scraper/import/import-job-response.dto.js';
import type {User} from '#generated/prisma/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashed',
    firstName: 'Jane',
    lastName: 'Smith',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'USD',
    role: 'USER',
    notifyPush: true,
    notifyEmail: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

const mockJobResponse: ImportJobResponseDto = {
    id: 'job-uuid-1',
    accountId: null,
    filename: 'transactions.csv',
    fileType: FileType.csv,
    status: 'completed',
    rowCount: 3,
    importedCount: 3,
    skippedCount: 0,
    errorMessage: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15')
};

const makeFile = (): Express.Multer.File =>
    ({
        originalname: 'transactions.csv',
        mimetype: 'text/csv',
        size: 100,
        buffer: Buffer.from('date,description,amount,type'),
        fieldname: 'file',
        encoding: '7bit',
        stream: null as unknown as NodeJS.ReadableStream,
        destination: '',
        filename: '',
        path: ''
    }) as Express.Multer.File;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportController', () => {
    let controller: ImportController;
    let service: ImportService;

    beforeEach(() => {
        service = {
            upload: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn()
        } as unknown as ImportService;

        controller = new ImportController(service);
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // isFileAllowed (static)
    // -----------------------------------------------------------------------

    describe('isFileAllowed', () => {
        it('should accept a file with text/csv mimetype', () => {
            expect(ImportController.isFileAllowed({mimetype: 'text/csv', originalname: 'a.csv'})).toBe(true);
        });

        it('should accept a .csv file even with octet-stream mimetype', () => {
            expect(ImportController.isFileAllowed({mimetype: 'application/octet-stream', originalname: 'data.csv'})).toBe(true);
        });

        it('should reject a non-CSV file', () => {
            expect(ImportController.isFileAllowed({mimetype: 'image/png', originalname: 'photo.png'})).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // fileFilter (Multer callback)
    // -----------------------------------------------------------------------

    describe('fileFilter', () => {
        it('should call cb(null, true) for an accepted file type', () => {
            const cb = vi.fn();
            ImportController.fileFilter({}, {mimetype: 'text/csv', originalname: 'data.csv'}, cb);
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should call cb(BadRequestException, false) for a rejected file type', () => {
            const cb = vi.fn();
            ImportController.fileFilter({}, {mimetype: 'image/png', originalname: 'photo.png'}, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);
        });
    });

    // -----------------------------------------------------------------------
    // upload
    // -----------------------------------------------------------------------

    describe('upload', () => {
        it('should throw BadRequestException when no file is attached', async () => {
            await expect(
                controller.upload(undefined as unknown as Express.Multer.File, {}, mockUser)
            ).rejects.toThrow(BadRequestException);
        });

        it('should call ImportService.upload and return 201 with job DTO', async () => {
            vi.mocked(service.upload).mockResolvedValue(mockJobResponse);
            const file = makeFile();

            const result = await controller.upload(file, {}, mockUser);

            expect(service.upload).toHaveBeenCalledWith(mockUser.id, file, undefined);
            expect(result).toEqual(mockJobResponse);
        });

        it('should pass accountId to ImportService.upload when provided', async () => {
            vi.mocked(service.upload).mockResolvedValue({...mockJobResponse, accountId: 'acct-id'});
            const file = makeFile();
            const dto = {accountId: 'acct-id'};

            await controller.upload(file, dto, mockUser);

            expect(service.upload).toHaveBeenCalledWith(mockUser.id, file, 'acct-id');
        });
    });

    // -----------------------------------------------------------------------
    // findAll
    // -----------------------------------------------------------------------

    describe('findAll', () => {
        it('should return an array of import jobs', async () => {
            vi.mocked(service.findAll).mockResolvedValue([mockJobResponse]);

            const result = await controller.findAll(mockUser);

            expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
            expect(result).toEqual([mockJobResponse]);
        });
    });

    // -----------------------------------------------------------------------
    // findOne
    // -----------------------------------------------------------------------

    describe('findOne', () => {
        it('should return a single import job', async () => {
            vi.mocked(service.findOne).mockResolvedValue(mockJobResponse);

            const result = await controller.findOne('job-uuid-1', mockUser);

            expect(service.findOne).toHaveBeenCalledWith(mockUser.id, 'job-uuid-1');
            expect(result).toEqual(mockJobResponse);
        });
    });
});
