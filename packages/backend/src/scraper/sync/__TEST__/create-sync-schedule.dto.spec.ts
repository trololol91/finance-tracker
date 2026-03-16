import {
    describe, it, expect, vi, beforeAll, afterAll
} from 'vitest';
import {
    validate, useContainer
} from 'class-validator';
import {plainToInstance} from 'class-transformer';
import {CreateSyncScheduleDto} from '#scraper/sync/dto/create-sync-schedule.dto.js';
import {RequiredInputsConstraint} from '#common/validators/required-inputs.validator.js';
import type {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';
import type {ValidationArguments} from 'class-validator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A structurally valid UUID v4 used throughout these tests. */
const VALID_ACCOUNT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRegistry = (scraper: BankScraper | undefined): ScraperRegistry =>
    ({findByBankId: vi.fn().mockReturnValue(scraper)}) as unknown as ScraperRegistry;

const makeScraper = (overrides: Partial<BankScraper> = {}): BankScraper => ({
    bankId: 'cibc',
    displayName: 'CIBC',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    inputSchema: [
        {key: 'username', label: 'Username', type: 'text', required: true},
        {key: 'password', label: 'Password', type: 'password', required: true},
        {key: 'rememberMe', label: 'Remember Me', type: 'text', required: false}
    ],
    login: vi.fn(),
    scrapeTransactions: vi.fn(),
    ...overrides
});

const makeArgs = (object: object): ValidationArguments =>
    ({object} as ValidationArguments);

// ---------------------------------------------------------------------------
// Provide a class-validator container so @Validate(RequiredInputsConstraint)
// receives a properly constructed instance instead of `new Constraint()` with
// no arguments (which would throw because scraperRegistry is undefined).
// ---------------------------------------------------------------------------

let sharedConstraint: RequiredInputsConstraint;

beforeAll(() => {
    sharedConstraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));
    useContainer(
        {
            get(cls: unknown) {
                if (cls === RequiredInputsConstraint) return sharedConstraint;
                return new (cls as new () => object)();
            }
        },
        {fallbackOnErrors: true}
    );
});

afterAll(() => {
    // Reset to default so other spec files in the same process are not affected.
    useContainer(
        {get(cls: unknown) { return new (cls as new () => object)(); }},
        {fallbackOnErrors: true}
    );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateSyncScheduleDto', () => {
    // -------------------------------------------------------------------------
    // Happy path — full decorator pipeline including RequiredInputsConstraint
    // -------------------------------------------------------------------------

    it('passes validation when all required inputs are provided plus a non-required key', async () => {
        const dto = plainToInstance(CreateSyncScheduleDto, {
            accountId: VALID_ACCOUNT_ID,
            bankId: 'cibc',
            inputs: {username: 'myuser', password: 'mypass', rememberMe: 'yes'},
            cron: '0 8 * * *'
        });

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
    });

    it('passes validation without optional lookbackDays', async () => {
        const dto = plainToInstance(CreateSyncScheduleDto, {
            accountId: VALID_ACCOUNT_ID,
            bankId: 'cibc',
            inputs: {username: 'u', password: 'p'},
            cron: '0 8 * * *'
        });

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
    });

    // -------------------------------------------------------------------------
    // RequiredInputsConstraint — tested directly with mocked registry
    // -------------------------------------------------------------------------

    describe('RequiredInputsConstraint.validate()', () => {
        it('returns true when all required inputs are supplied with non-empty values', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            const result = constraint.validate(
                {username: 'user1', password: 'pass1'},
                makeArgs({bankId: 'cibc', inputs: {username: 'user1', password: 'pass1'}})
            );

            expect(result).toBe(true);
        });

        it('returns true when a non-required key is included alongside all required keys', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            const result = constraint.validate(
                {username: 'user1', password: 'pass1', rememberMe: 'yes'},
                makeArgs({
                    bankId: 'cibc',
                    inputs: {username: 'user1', password: 'pass1', rememberMe: 'yes'}
                })
            );

            expect(result).toBe(true);
        });

        it('returns false when a required input key is missing from inputs', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            // password is absent — should fail
            const result = constraint.validate(
                {username: 'user1'},
                makeArgs({bankId: 'cibc', inputs: {username: 'user1'}})
            );

            expect(result).toBe(false);
        });

        it('returns false when a required input has an empty string value', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            const result = constraint.validate(
                {username: 'user1', password: ''},
                makeArgs({bankId: 'cibc', inputs: {username: 'user1', password: ''}})
            );

            expect(result).toBe(false);
        });

        it('returns false when a required input has a whitespace-only value', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            const result = constraint.validate(
                {username: 'user1', password: '   '},
                makeArgs({bankId: 'cibc', inputs: {username: 'user1', password: '   '}})
            );

            expect(result).toBe(false);
        });

        it('returns true when bankId is not found in registry — bankId existence is validated separately in the service', () => {
            // Per design: the constraint returns true (skips) when bankId is unknown
            // so a more specific error can be raised by SyncScheduleService.
            const constraint = new RequiredInputsConstraint(makeRegistry(undefined));

            const result = constraint.validate(
                {username: 'user1', password: 'pass1'},
                makeArgs({bankId: 'unknown-bank', inputs: {username: 'user1', password: 'pass1'}})
            );

            expect(result).toBe(true);
        });

        it('returns true when bankId is absent from the DTO object (defers to @IsString/@IsNotEmpty)', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            const result = constraint.validate(
                {username: 'user1', password: 'pass1'},
                makeArgs({inputs: {username: 'user1', password: 'pass1'}}) // no bankId
            );

            expect(result).toBe(true);
        });

        it('returns true when inputs is absent from the DTO object (defers to @IsObject)', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            const result = constraint.validate(
                undefined,
                makeArgs({bankId: 'cibc'}) // no inputs
            );

            expect(result).toBe(true);
        });

        it('produces a human-readable defaultMessage naming the failed key', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));

            // Trigger a failure first so failedKey gets populated
            constraint.validate(
                {username: 'user1'}, // password missing
                makeArgs({bankId: 'cibc', inputs: {username: 'user1'}})
            );

            const msg = constraint.defaultMessage(
                makeArgs({bankId: 'cibc', inputs: {username: 'user1'}})
            );

            expect(msg).toContain('password');
            expect(msg).toContain('required');
        });

        it('defaults defaultMessage to "unknown" when validate() has never been called', () => {
            const constraint = new RequiredInputsConstraint(makeRegistry(makeScraper()));
            // No validate() call — failedKey is undefined
            const msg = constraint.defaultMessage(makeArgs({bankId: 'cibc', inputs: {}}));

            expect(msg).toContain('unknown');
        });
    });

    // -------------------------------------------------------------------------
    // @IsStringRecord — non-string value in inputs
    // -------------------------------------------------------------------------

    describe('@IsStringRecord', () => {
        it('fails when a non-string value (number) is present in inputs', async () => {
            const dto = plainToInstance(CreateSyncScheduleDto, {
                accountId: VALID_ACCOUNT_ID,
                bankId: 'cibc',
                inputs: {username: 123, password: 'secret'},
                cron: '0 8 * * *'
            });

            const errors = await validate(dto);

            const inputsErrors = errors.find(e => e.property === 'inputs');
            expect(inputsErrors).toBeDefined();
            expect(Object.keys(inputsErrors!.constraints ?? {})).toContain('isStringRecord');
        });
    });

    // -------------------------------------------------------------------------
    // @IsObject — inputs field entirely absent
    // -------------------------------------------------------------------------

    describe('@IsObject', () => {
        it('fails validation when inputs is entirely absent from the payload', async () => {
            const dto = plainToInstance(CreateSyncScheduleDto, {
                accountId: VALID_ACCOUNT_ID,
                bankId: 'cibc',
                cron: '0 8 * * *'
                // inputs intentionally omitted
            });

            const errors = await validate(dto);

            const inputsErrors = errors.find(e => e.property === 'inputs');
            expect(inputsErrors).toBeDefined();
            expect(inputsErrors!.constraints).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // Other field-level validations
    // -------------------------------------------------------------------------

    describe('field validations', () => {
        it('fails when accountId is not a valid UUID v4', async () => {
            const dto = plainToInstance(CreateSyncScheduleDto, {
                accountId: 'not-a-uuid',
                bankId: 'cibc',
                inputs: {username: 'u', password: 'p'},
                cron: '0 8 * * *'
            });

            const errors = await validate(dto);

            expect(errors.find(e => e.property === 'accountId')).toBeDefined();
        });

        it('fails when bankId is an empty string', async () => {
            const dto = plainToInstance(CreateSyncScheduleDto, {
                accountId: VALID_ACCOUNT_ID,
                bankId: '',
                inputs: {username: 'u', password: 'p'},
                cron: '0 8 * * *'
            });

            const errors = await validate(dto);

            expect(errors.find(e => e.property === 'bankId')).toBeDefined();
        });

        it('fails when cron is an empty string', async () => {
            const dto = plainToInstance(CreateSyncScheduleDto, {
                accountId: VALID_ACCOUNT_ID,
                bankId: 'cibc',
                inputs: {username: 'u', password: 'p'},
                cron: ''
            });

            const errors = await validate(dto);

            expect(errors.find(e => e.property === 'cron')).toBeDefined();
        });

        it('fails when lookbackDays is below minimum (1)', async () => {
            const dto = plainToInstance(CreateSyncScheduleDto, {
                accountId: VALID_ACCOUNT_ID,
                bankId: 'cibc',
                inputs: {username: 'u', password: 'p'},
                cron: '0 8 * * *',
                lookbackDays: 0
            });

            const errors = await validate(dto);

            expect(errors.find(e => e.property === 'lookbackDays')).toBeDefined();
        });

        it('fails when lookbackDays exceeds maximum (365)', async () => {
            const dto = plainToInstance(CreateSyncScheduleDto, {
                accountId: VALID_ACCOUNT_ID,
                bankId: 'cibc',
                inputs: {username: 'u', password: 'p'},
                cron: '0 8 * * *',
                lookbackDays: 366
            });

            const errors = await validate(dto);

            expect(errors.find(e => e.property === 'lookbackDays')).toBeDefined();
        });
    });
});
