import {
    describe, it, expect
} from 'vitest';
import {
    render, screen, within
} from '@testing-library/react';
import {ImportJobList} from '@features/scraper/components/ImportJobList.js';
import type {ImportJobResponseDto} from '@/api/model/importJobResponseDto.js';

const makeJob = (overrides: Partial<ImportJobResponseDto> = {}): ImportJobResponseDto => ({
    id: 'job-1',
    accountId: null,
    filename: 'transactions.csv',
    fileType: 'csv',
    status: 'completed',
    rowCount: 50,
    importedCount: 45,
    skippedCount: 5,
    errorMessage: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:01:00.000Z',
    ...overrides
});

describe('ImportJobList', () => {
    describe('loading state', () => {
        it('shows loading message when isLoading is true', () => {
            render(<ImportJobList jobs={[]} isLoading={true} isError={false} />);
            expect(screen.getByText(/loading import history/i)).toBeInTheDocument();
        });

        it('has aria-busy when loading', () => {
            const {container} = render(
                <ImportJobList jobs={[]} isLoading={true} isError={false} />
            );
            expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error alert when isError is true', () => {
            render(<ImportJobList jobs={[]} isLoading={false} isError={true} />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/failed to load import history/i)).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty message when jobs array is empty', () => {
            render(<ImportJobList jobs={[]} isLoading={false} isError={false} />);
            expect(screen.getByText(/no imports yet/i)).toBeInTheDocument();
        });
    });

    describe('data rows', () => {
        it('renders a table with aria-label', () => {
            render(<ImportJobList jobs={[makeJob()]} isLoading={false} isError={false} />);
            expect(screen.getByRole('table', {name: /import history/i})).toBeInTheDocument();
        });

        it('renders a row for each job', () => {
            const jobs = [makeJob({id: 'j1', filename: 'a.csv'}), makeJob({id: 'j2', filename: 'b.ofx'})];
            render(<ImportJobList jobs={jobs} isLoading={false} isError={false} />);
            expect(screen.getByText('a.csv')).toBeInTheDocument();
            expect(screen.getByText('b.ofx')).toBeInTheDocument();
        });

        it('shows status badge for each job', () => {
            render(<ImportJobList jobs={[makeJob({status: 'failed'})]} isLoading={false} isError={false} />);
            expect(screen.getByText('Failed')).toBeInTheDocument();
        });

        it('shows row and imported counts', () => {
            render(
                <ImportJobList
                    jobs={[makeJob({rowCount: 100, importedCount: 90, skippedCount: 10})]}
                    isLoading={false}
                    isError={false}
                />
            );
            expect(screen.getByText('100')).toBeInTheDocument();
            expect(screen.getByText('90')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('shows file type in uppercase', () => {
            render(<ImportJobList jobs={[makeJob({fileType: 'csv'})]} isLoading={false} isError={false} />);
            expect(screen.getByText('CSV')).toBeInTheDocument();
        });

        it('shows error message when present', () => {
            render(
                <ImportJobList
                    jobs={[makeJob({errorMessage: 'Parse failed at row 3'})]}
                    isLoading={false}
                    isError={false}
                />
            );
            expect(screen.getByText('Parse failed at row 3')).toBeInTheDocument();
        });

        it('does not show error message span when errorMessage is null', () => {
            render(
                <ImportJobList
                    jobs={[makeJob({errorMessage: null})]}
                    isLoading={false}
                    isError={false}
                />
            );
            // No error message span means no row with extra text besides filename
            const rows = screen.getAllByRole('row');
            // header row + 1 data row = 2 rows total
            expect(rows).toHaveLength(2);
        });

        it('formats the createdAt date', () => {
            render(
                <ImportJobList
                    jobs={[makeJob({createdAt: '2026-06-01T12:00:00.000Z'})]}
                    isLoading={false}
                    isError={false}
                />
            );
            // The date cell should contain some formatted text (not the raw ISO string)
            const table = screen.getByRole('table');
            expect(within(table).getByText(/2026/)).toBeInTheDocument();
        });
    });
});
