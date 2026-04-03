import {
    Controller, Get, UseGuards
} from '@nestjs/common';
import {
    ApiTags, ApiBearerAuth, ApiOperation
} from '@nestjs/swagger';
import {FlexibleAuthGuard} from '#auth/guards/flexible-auth.guard.js';
import {ScopesGuard} from '#auth/guards/scopes.guard.js';
import {RequireScopes} from '#auth/decorators/require-scopes.decorator.js';
import {AiCategorizationService} from './ai-categorization.service.js';

interface AiStatusResponse {
    available: boolean;
    provider: string;
    model: string;
}

@ApiTags('ai-categorization')
@ApiBearerAuth()
@UseGuards(FlexibleAuthGuard, ScopesGuard)
@Controller('ai-categorization')
export class AiCategorizationController {
    constructor(private readonly aiCategorizationService: AiCategorizationService) {}

    @Get('status')
    @RequireScopes('transactions:read')
    @ApiOperation({summary: 'Get AI categorization availability and configuration'})
    public getStatus(): AiStatusResponse {
        return {
            available: this.aiCategorizationService.available,
            provider: this.aiCategorizationService.aiProvider,
            model: this.aiCategorizationService.aiModel
        };
    }
}
