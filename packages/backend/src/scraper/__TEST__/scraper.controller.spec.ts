import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {ScraperController} from '#scraper/scraper.controller.js';
import type {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {ScraperInfoDto} from '#scraper/scraper-info.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeScraperInfo = (overrides: Partial<ScraperInfoDto> = {}): ScraperInfoDto => ({
    bankId: 'td',
    displayName: 'TD Canada Trust',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScraperController', () => {
    let controller: ScraperController;
    let registry: ScraperRegistry;

    beforeEach(() => {
        registry = {
            listAll: vi.fn()
            // ScraperController only calls listAll; findByBankId and has are not needed
        } as unknown as ScraperRegistry;

        controller = new ScraperController(registry);
    });

    // -------------------------------------------------------------------------
    // GET /scrapers — listScrapers
    // -------------------------------------------------------------------------

    describe('listScrapers', () => {
        it('should return an empty array when no scrapers are registered', () => {
            vi.mocked(registry.listAll).mockReturnValue([]);

            const result = controller.listScrapers();

            expect(result).toEqual([]);
            expect(registry.listAll).toHaveBeenCalledOnce();
        });

        it('should return all registered scraper metadata from the registry', () => {
            const scrapers: ScraperInfoDto[] = [
                makeScraperInfo({bankId: 'td', displayName: 'TD Canada Trust'}),
                makeScraperInfo({bankId: 'cibc', displayName: 'CIBC'})
            ];
            vi.mocked(registry.listAll).mockReturnValue(scrapers);

            const result = controller.listScrapers();

            expect(result).toHaveLength(2);
            expect(result[0].bankId).toBe('td');
            expect(result[0].displayName).toBe('TD Canada Trust');
            expect(result[1].bankId).toBe('cibc');
            expect(result[1].displayName).toBe('CIBC');
        });

        it('should return the exact reference from registry.listAll (no transformation)', () => {
            const scrapers: ScraperInfoDto[] = [
                makeScraperInfo({bankId: 'rbc', displayName: 'RBC'})
            ];
            vi.mocked(registry.listAll).mockReturnValue(scrapers);

            const result = controller.listScrapers();

            expect(result).toBe(scrapers);
        });

        it('should include all DTO fields in returned metadata', () => {
            const fullInfo = makeScraperInfo({
                bankId: 'cibc',
                displayName: 'CIBC',
                requiresMfaOnEveryRun: true,
                maxLookbackDays: 60,
                pendingTransactionsIncluded: true
            });
            vi.mocked(registry.listAll).mockReturnValue([fullInfo]);

            const [result] = controller.listScrapers();

            expect(result.bankId).toBe('cibc');
            expect(result.displayName).toBe('CIBC');
            expect(result.requiresMfaOnEveryRun).toBe(true);
            expect(result.maxLookbackDays).toBe(60);
            expect(result.pendingTransactionsIncluded).toBe(true);
        });

    });
});
