import {
    describe,
    it,
    expect
} from 'vitest';
import {validate} from 'class-validator';
import {plainToInstance} from 'class-transformer';
import {TransactionFilterDto} from '#transactions/dto/transaction-filter.dto.js';

// ---------------------------------------------------------------------------
// TransactionFilterDto — cross-field date range validation (Issue 4)
// ---------------------------------------------------------------------------

const validateDto = async (plain: Record<string, unknown>): Promise<string[]> => {
    const instance = plainToInstance(TransactionFilterDto, plain);
    const errors = await validate(instance);
    return errors.flatMap(e => Object.values(e.constraints ?? {}));
};

describe('TransactionFilterDto — date range cross-field validation', () => {
    it('should pass when only startDate is provided', async () => {
        const errors = await validateDto({startDate: '2026-01-01T00:00:00.000Z'});
        expect(errors).toHaveLength(0);
    });

    it('should pass when only endDate is provided', async () => {
        const errors = await validateDto({endDate: '2026-12-31T23:59:59.999Z'});
        expect(errors).toHaveLength(0);
    });

    it('should pass when startDate equals endDate', async () => {
        const errors = await validateDto({
            startDate: '2026-06-15T00:00:00.000Z',
            endDate: '2026-06-15T00:00:00.000Z'
        });
        expect(errors).toHaveLength(0);
    });

    it('should pass when startDate is before endDate', async () => {
        const errors = await validateDto({
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2026-12-31T23:59:59.999Z'
        });
        expect(errors).toHaveLength(0);
    });

    it('should fail with "startDate must not be after endDate" when startDate is after endDate', async () => {
        const errors = await validateDto({
            startDate: '2026-12-31T23:59:59.999Z',
            endDate: '2026-01-01T00:00:00.000Z'
        });
        expect(errors).toContain('startDate must not be after endDate');
    });

    it('should fail when startDate is 1ms after endDate', async () => {
        const errors = await validateDto({
            startDate: '2026-06-15T00:00:00.001Z',
            endDate: '2026-06-15T00:00:00.000Z'
        });
        expect(errors).toContain('startDate must not be after endDate');
    });

    it('should pass when neither startDate nor endDate is provided', async () => {
        const errors = await validateDto({});
        expect(errors).toHaveLength(0);
    });

    it('should not emit the cross-field error when endDate is not a valid date string', async () => {
        // Guard returns true (skip) when endDate is unparseable — @IsDateString() owns that error.
        const errors = await validateDto({
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: 'not-a-date'
        });
        expect(errors).not.toContain('startDate must not be after endDate');
        expect(errors.some((e) => e.toLowerCase().includes('date'))).toBe(true);
    });

    it('should not emit the cross-field error when startDate is not a valid date string', async () => {
        const errors = await validateDto({
            startDate: 'not-a-date',
            endDate: '2026-12-31T23:59:59.999Z'
        });
        expect(errors).not.toContain('startDate must not be after endDate');
        const hasDateError = errors.some((e) => e.toLowerCase().includes('date'));
        expect(hasDateError).toBe(true);
    });
});
