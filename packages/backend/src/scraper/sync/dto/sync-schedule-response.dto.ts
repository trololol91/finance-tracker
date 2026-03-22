import {
    ApiProperty,
    ApiPropertyOptional
} from '@nestjs/swagger';
import type {SyncSchedule} from '#generated/prisma/client.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';

export class SyncScheduleResponseDto {
    @ApiProperty() public id!: string;
    @ApiProperty() public accountId!: string;
    @ApiProperty() public bankId!: string;
    @ApiProperty() public displayName!: string;
    @ApiProperty() public cron!: string;
    @ApiProperty() public enabled!: boolean;
    @ApiProperty() public requiresMfaOnEveryRun!: boolean;
    @ApiProperty() public maxLookbackDays!: number;
    @ApiProperty() public pendingTransactionsIncluded!: boolean;
    @ApiProperty() public lookbackDays!: number;
    @ApiProperty() public autoCategorizeLlm!: boolean;
    @ApiPropertyOptional({type: String, nullable: true}) public lastRunAt!: string | null;
    @ApiPropertyOptional({
        enum: ['success', 'failed', 'mfa_required'],
        nullable: true
    }) public lastRunStatus!: string | null;
    @ApiPropertyOptional({type: String, nullable: true})
    public lastSuccessfulSyncAt!: string | null;
    @ApiProperty() public createdAt!: string;
    @ApiProperty() public updatedAt!: string;

    public static fromEntity(
        schedule: SyncSchedule,
        scraper: BankScraper
    ): SyncScheduleResponseDto {
        const dto = new SyncScheduleResponseDto();
        dto.id = schedule.id;
        dto.accountId = schedule.accountId;
        dto.bankId = schedule.bankId;
        dto.displayName = scraper.displayName;
        dto.cron = schedule.cron;
        dto.enabled = schedule.enabled;
        dto.requiresMfaOnEveryRun = scraper.requiresMfaOnEveryRun;
        dto.maxLookbackDays = scraper.maxLookbackDays;
        dto.pendingTransactionsIncluded = scraper.pendingTransactionsIncluded;
        dto.lookbackDays = schedule.lookbackDays;
        dto.autoCategorizeLlm = schedule.autoCategorizeLlm;
        dto.lastRunAt = schedule.lastRunAt?.toISOString() ?? null;
        dto.lastRunStatus = schedule.lastRunStatus ?? null;
        dto.lastSuccessfulSyncAt = schedule.lastSuccessfulSyncAt?.toISOString() ?? null;
        dto.createdAt = schedule.createdAt.toISOString();
        dto.updatedAt = schedule.updatedAt.toISOString();
        return dto;
    }
}
