import {
    ApiProperty,
    ApiPropertyOptional
} from '@nestjs/swagger';
import type {SyncJob} from '#generated/prisma/client.js';

export class SyncJobResponseDto {
    @ApiProperty() public id!: string;
    @ApiProperty() public syncScheduleId!: string;
    @ApiProperty() public triggeredBy!: string;
    @ApiProperty() public status!: string;
    @ApiPropertyOptional({type: String, nullable: true}) public message!: string | null;
    @ApiPropertyOptional({type: String, nullable: true}) public mfaChallenge!: string | null;
    @ApiProperty() public importedCount!: number;
    @ApiProperty() public skippedCount!: number;
    @ApiPropertyOptional({type: String, nullable: true}) public errorMessage!: string | null;
    @ApiPropertyOptional({type: String, nullable: true}) public requestStartDate!: string | null;
    @ApiPropertyOptional({type: String, nullable: true}) public requestEndDate!: string | null;
    @ApiPropertyOptional({type: String, nullable: true}) public startedAt!: string | null;
    @ApiPropertyOptional({type: String, nullable: true}) public completedAt!: string | null;
    @ApiProperty() public createdAt!: string;
    @ApiProperty() public updatedAt!: string;

    public static fromEntity(job: SyncJob): SyncJobResponseDto {
        const dto = new SyncJobResponseDto();
        dto.id = job.id;
        dto.syncScheduleId = job.syncScheduleId;
        dto.triggeredBy = job.triggeredBy;
        dto.status = job.status;
        dto.message = job.message ?? null;
        dto.mfaChallenge = job.mfaChallenge ?? null;
        dto.importedCount = job.importedCount;
        dto.skippedCount = job.skippedCount;
        dto.errorMessage = job.errorMessage ?? null;
        dto.requestStartDate = job.requestStartDate?.toISOString() ?? null;
        dto.requestEndDate = job.requestEndDate?.toISOString() ?? null;
        dto.startedAt = job.startedAt?.toISOString() ?? null;
        dto.completedAt = job.completedAt?.toISOString() ?? null;
        dto.createdAt = job.createdAt.toISOString();
        dto.updatedAt = job.updatedAt.toISOString();
        return dto;
    }
}
