import {Controller, Get} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {ScraperInfo} from '#scraper/interfaces/bank-scraper.interface.js';

/**
 * Public endpoint that lists all registered bank scrapers.
 * Used by the frontend to populate the bank picker dynamically.
 * No authentication required — scraper metadata is not sensitive.
 */
@ApiTags('scrapers')
@Controller('scrapers')
export class ScraperController {
    constructor(private readonly registry: ScraperRegistry) {}

    /**
     * GET /scrapers
     * Returns the list of built-in and plugin scrapers with their metadata.
     */
    @Get()
    @ApiOperation({
        summary: 'List registered bank scrapers',
        description:
            'Returns metadata for all registered bank scrapers. ' +
            'Used by the frontend to populate the bank picker. No authentication required.'
    })
    @ApiResponse({
        status: 200,
        description: 'Array of scraper metadata objects'
    })
    public listScrapers(): ScraperInfo[] {
        return this.registry.listAll();
    }
}
