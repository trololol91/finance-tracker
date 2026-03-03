import {
    PartialType,
    OmitType
} from '@nestjs/swagger';
import {ApiPropertyOptional} from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional
} from 'class-validator';
import {CreateSyncScheduleDto} from '#scraper/sync/dto/create-sync-schedule.dto.js';

export class UpdateSyncScheduleDto extends PartialType(
    OmitType(CreateSyncScheduleDto, ['accountId', 'bankId'] as const)
) {
    @ApiPropertyOptional({description: 'Enable or disable the sync schedule'})
    @IsOptional()
    @IsBoolean()
    public enabled?: boolean;
}
