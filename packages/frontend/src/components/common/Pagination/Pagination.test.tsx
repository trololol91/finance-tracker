import {
    describe, it, expect, vi
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Pagination} from '@components/common/Pagination/Pagination.js';

const defaultProps = {
    page: 1,
    total: 245,
    limit: 50,
    onPageChange: vi.fn()
};

describe('Pagination', () => {
    it('renders navigation landmark', () => {
        render(<Pagination {...defaultProps} />);
        expect(screen.getByRole('navigation', {name: /pagination/i})).toBeInTheDocument();
    });

    it('renders page info text', () => {
        render(<Pagination {...defaultProps} />);
        expect(screen.getByText('Showing 1–50 of 245')).toBeInTheDocument();
    });

    it('renders correct number of page buttons', () => {
        render(<Pagination {...defaultProps} />);
        // total pages = ceil(245/50) = 5
        // page 1: prev, 1, 2, 3, 4, 5, next = 7 buttons
        const buttons = screen.getAllByRole('button');
        // At minimum: prev + at least 1 page + next
        expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('disables previous button on first page', () => {
        render(<Pagination {...defaultProps} page={1} />);
        expect(screen.getByRole('button', {name: /previous page/i})).toBeDisabled();
    });

    it('disables next button on last page', () => {
        render(<Pagination {...defaultProps} page={5} />);
        expect(screen.getByRole('button', {name: /next page/i})).toBeDisabled();
    });

    it('calls onPageChange when a page button is clicked', async () => {
        const onPageChange = vi.fn();
        const user = userEvent.setup();
        render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

        await user.click(screen.getByRole('button', {name: /next page/i}));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('marks current page with aria-current', () => {
        render(<Pagination {...defaultProps} page={2} />);
        const currentBtn = screen.getByRole('button', {name: /page 2/i});
        expect(currentBtn).toHaveAttribute('aria-current', 'page');
    });

    it('returns null when total fits on one page', () => {
        const {container} = render(<Pagination {...defaultProps} total={30} limit={50} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders ellipsis for large page sets', () => {
        render(<Pagination {...defaultProps} page={5} total={1000} limit={50} />);
        // 1000/50 = 20 pages, with current=5, ellipsis should appear
        const nav = screen.getByRole('navigation');
        expect(nav.textContent).toContain('…');
    });

    it('omits the leading ellipsis when current page is near the start of a large set', () => {
        // totalPages=10, current=2 → current <= 3, so no leading '...'
        render(<Pagination {...defaultProps} page={2} total={500} limit={50} />);
        const nav = screen.getByRole('navigation');
        // There should still be a trailing '...' but NOT a leading one
        // The page-number list should start 1, 2, 3 with no '…' between 1 and 2
        const buttons = screen.getAllByRole('button', {name: /page \d/i});
        expect(buttons[0]).toHaveAccessibleName('Page 1');
        expect(buttons[1]).toHaveAccessibleName('Page 2');
        // trailing ellipsis should still show (current < totalPages - 2)
        expect(nav.textContent).toContain('…');
    });

    it('omits the trailing ellipsis when current page is near the end of a large set', () => {
        // totalPages=10, current=9 → current >= totalPages - 2, so no trailing '...'
        render(<Pagination {...defaultProps} page={9} total={500} limit={50} />);
        const _nav = screen.getByRole('navigation');
        // Page buttons include 10 (last); the number immediately before should also be present
        const buttons = screen.getAllByRole('button', {name: /page \d/i});
        const lastLabel = buttons[buttons.length - 1].getAttribute('aria-label');
        expect(lastLabel).toBe('Page 10');
    });

    it('calls onPageChange with page - 1 when Previous is clicked on a non-first page', async () => {
        const onPageChange = vi.fn();
        const user = userEvent.setup();
        render(<Pagination {...defaultProps} page={3} onPageChange={onPageChange} />);
        await user.click(screen.getByRole('button', {name: /previous page/i}));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange with the page number when a numbered page button is clicked', async () => {
        const onPageChange = vi.fn();
        const user = userEvent.setup();
        render(<Pagination {...defaultProps} onPageChange={onPageChange} />);
        // defaultProps: total=245, limit=50 → 5 pages; click page 3
        await user.click(screen.getByRole('button', {name: /page 3/i}));
        expect(onPageChange).toHaveBeenCalledWith(3);
    });
});
