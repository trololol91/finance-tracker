import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import type {SpendingByCategoryDto} from '@/api/model/spendingByCategoryDto.js';

// Mock the generated API hook before importing the component
vi.mock('@/api/dashboard/dashboard.js', () => ({
    useDashboardControllerGetSpendingByCategory: vi.fn()
}));

import {useDashboardControllerGetSpendingByCategory} from '@/api/dashboard/dashboard.js';
import {SpendingByCategoryPanel} from '@features/dashboard/components/SpendingByCategoryPanel.js';

const mockHook = useDashboardControllerGetSpendingByCategory as ReturnType<typeof vi.fn>;

const makeSpendingData = (
    overrides: Partial<SpendingByCategoryDto> = {}
): SpendingByCategoryDto => ({
    month: '2026-03',
    items: [
        {
            categoryId: 'cat-1',
            categoryName: 'Food',
            color: null,
            total: 300,
            percentage: 60
        },
        {
            categoryId: null,
            categoryName: 'Uncategorised',
            color: null,
            total: 200,
            percentage: 40
        }
    ],
    ...overrides
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('SpendingByCategoryPanel', () => {
    it('renders the section heading', () => {
        mockHook.mockReturnValue({data: undefined, isLoading: true, isError: false});
        render(<SpendingByCategoryPanel />);
        expect(screen.getByRole('heading', {name: /spending by category/i})).toBeInTheDocument();
    });

    it('shows loading skeleton when isLoading is true', () => {
        mockHook.mockReturnValue({data: undefined, isLoading: true, isError: false});
        const {container} = render(<SpendingByCategoryPanel />);
        expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('shows error message when isError is true', () => {
        mockHook.mockReturnValue({data: undefined, isLoading: false, isError: true});
        render(<SpendingByCategoryPanel />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load spending/i)).toBeInTheDocument();
    });

    it('shows empty message when items list is empty', () => {
        mockHook.mockReturnValue({
            data: makeSpendingData({items: []}),
            isLoading: false,
            isError: false
        });
        render(<SpendingByCategoryPanel />);
        expect(screen.getByText(/no spending recorded/i)).toBeInTheDocument();
    });

    it('renders category names', () => {
        mockHook.mockReturnValue({
            data: makeSpendingData(),
            isLoading: false,
            isError: false
        });
        render(<SpendingByCategoryPanel />);
        expect(screen.getByText('Food')).toBeInTheDocument();
        expect(screen.getByText('Uncategorised')).toBeInTheDocument();
    });

    it('renders formatted totals', () => {
        mockHook.mockReturnValue({
            data: makeSpendingData(),
            isLoading: false,
            isError: false
        });
        render(<SpendingByCategoryPanel />);
        expect(screen.getByText(/300\.00/)).toBeInTheDocument();
        expect(screen.getByText(/200\.00/)).toBeInTheDocument();
    });

    it('renders percentage values', () => {
        mockHook.mockReturnValue({
            data: makeSpendingData(),
            isLoading: false,
            isError: false
        });
        render(<SpendingByCategoryPanel />);
        expect(screen.getByText('60.0%')).toBeInTheDocument();
        expect(screen.getByText('40.0%')).toBeInTheDocument();
    });

    it('renders the accessible list', () => {
        mockHook.mockReturnValue({
            data: makeSpendingData(),
            isLoading: false,
            isError: false
        });
        render(<SpendingByCategoryPanel />);
        expect(screen.getByRole('list', {name: /spending by category/i})).toBeInTheDocument();
    });

    it('passes month param to the hook when month prop is provided', () => {
        mockHook.mockReturnValue({data: undefined, isLoading: true, isError: false});
        render(<SpendingByCategoryPanel month="2026-01" />);
        expect(mockHook).toHaveBeenCalledWith({month: '2026-01'});
    });

    it('passes undefined to the hook when no month prop is provided', () => {
        mockHook.mockReturnValue({data: undefined, isLoading: true, isError: false});
        render(<SpendingByCategoryPanel />);
        expect(mockHook).toHaveBeenCalledWith(undefined);
    });

    it('renders a coloured swatch for items with a non-null color', () => {
        // color DTO type is `{ [key: string]: unknown } | null`;
        // cast via unknown so resolveColor receives a string at runtime
        const colorAsDto = '#ff0000' as unknown as SpendingByCategoryDto['items'][number]['color'];
        mockHook.mockReturnValue({
            data: makeSpendingData({
                items: [{
                    categoryId: 'cat-x',
                    categoryName: 'Transport',
                    color: colorAsDto,
                    total: 100,
                    percentage: 100
                }]
            }),
            isLoading: false,
            isError: false
        });
        const {container} = render(<SpendingByCategoryPanel />);
        const swatch = container.querySelector('[aria-hidden="true"]');
        expect(swatch).toHaveStyle({backgroundColor: '#ff0000'});
    });
});
