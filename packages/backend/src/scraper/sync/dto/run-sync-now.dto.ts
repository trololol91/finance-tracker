import {
    IsDateString,
    IsOptional,
    IsBoolean
} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';

/** Body accepted by POST /sync-schedules/:id/run-now. */
export class RunSyncNowDto {
    @ApiPropertyOptional({
        description:
            'Override the computed start date for this sync window. ' +
            'ISO 8601 UTC string (e.g. "2025-01-01T00:00:00.000Z"). ' +
            'If omitted the service uses the standard lookback calculation.',
        example: '2025-01-01T00:00:00.000Z'
    })
    @IsOptional()
    @IsDateString()
    public startDate?: string;

    @ApiPropertyOptional({
        description:
            'When true, runs the full scrape pipeline (login, scrape, dedup check) ' +
            'but skips the final database write. All SSE status events are emitted ' +
            'normally; the terminal complete event will have importedCount: 0. ' +
            'Defaults to false when omitted.',
        example: true,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    public dryRun?: boolean;
}
