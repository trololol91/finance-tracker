import {ApiProperty} from '@nestjs/swagger';
import type {ImportJob} from '#generated/prisma/client.js';

export class ImportJobResponseDto {
    @ApiProperty({description: 'Import job UUID', example: '550e8400-e29b-41d4-a716-446655440000'})
    public id!: string;

    @ApiProperty({description: 'Target account UUID', nullable: true, type: String})
    public accountId!: string | null;

    @ApiProperty({description: 'Original filename', example: 'transactions.csv'})
    public filename!: string;

    @ApiProperty({description: 'File type', enum: ['csv'], example: 'csv'})
    public fileType!: string;

    @ApiProperty({description: 'Parse / import status', enum: ['pending', 'processing', 'completed', 'failed']})
    public status!: string;

    @ApiProperty({description: 'Total rows parsed from file', example: 42})
    public rowCount!: number;

    @ApiProperty({description: 'Rows successfully inserted', example: 39})
    public importedCount!: number;

    @ApiProperty({description: 'Rows skipped due to deduplication', example: 3})
    public skippedCount!: number;

    @ApiProperty({description: 'Error message if status=failed', nullable: true, type: String})
    public errorMessage!: string | null;

    @ApiProperty({description: 'Creation timestamp'})
    public createdAt!: Date;

    @ApiProperty({description: 'Last update timestamp'})
    public updatedAt!: Date;

    public static fromEntity(job: ImportJob): ImportJobResponseDto {
        return {
            id: job.id,
            accountId: job.accountId ?? null,
            filename: job.filename,
            fileType: job.fileType,
            status: job.status,
            rowCount: job.rowCount,
            importedCount: job.importedCount,
            skippedCount: job.skippedCount,
            errorMessage: job.errorMessage ?? null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt
        };
    }
}
