import {
    Controller, Get, UseGuards
} from '@nestjs/common';
import {
    ApiTags, ApiBearerAuth, ApiOperation, ApiResponse
} from '@nestjs/swagger';
import {ApiProperty} from '@nestjs/swagger';
import {FlexibleAuthGuard} from '#auth/guards/flexible-auth.guard.js';
import {ScopesGuard} from '#auth/guards/scopes.guard.js';
import {RequireScopes} from '#auth/decorators/require-scopes.decorator.js';
import {AiCategorizationService} from '#ai-categorization/ai-categorization.service.js';

class AiStatusResponseDto {
    @ApiProperty({description: 'Whether AI categorization is available', example: true})
    public available!: boolean;

    @ApiProperty({description: 'AI provider name', example: 'openai'})
    public provider!: string;

    @ApiProperty({description: 'AI model identifier', example: 'gpt-4o-mini'})
    public model!: string;
}

@ApiTags('ai-categorization')
@ApiBearerAuth('JWT-auth')
@UseGuards(FlexibleAuthGuard, ScopesGuard)
@Controller('ai-categorization')
export class AiCategorizationController {
    constructor(private readonly aiCategorizationService: AiCategorizationService) {}

    @Get('status')
    @RequireScopes('transactions:read')
    @ApiOperation({summary: 'Get AI categorization availability and configuration'})
    @ApiResponse({status: 200, description: 'AI status returned', type: AiStatusResponseDto})
    public getStatus(): AiStatusResponseDto {
        return {
            available: this.aiCategorizationService.available,
            provider: this.aiCategorizationService.aiProvider,
            model: this.aiCategorizationService.aiModel
        };
    }
}
