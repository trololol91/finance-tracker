import {
    Controller, Get, UseGuards
} from '@nestjs/common';
import {
    ApiTags, ApiBearerAuth, ApiOperation
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {AiCategorizationService} from './ai-categorization.service.js';

interface AiStatusResponse {
    available: boolean;
    provider: string;
    model: string;
}

@ApiTags('ai-categorization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-categorization')
export class AiCategorizationController {
    constructor(private readonly aiCategorizationService: AiCategorizationService) {}

    @Get('status')
    @ApiOperation({summary: 'Get AI categorization availability and configuration'})
    public getStatus(): AiStatusResponse {
        return {
            available: this.aiCategorizationService.available,
            provider: this.aiCategorizationService.aiProvider,
            model: this.aiCategorizationService.aiModel
        };
    }
}
