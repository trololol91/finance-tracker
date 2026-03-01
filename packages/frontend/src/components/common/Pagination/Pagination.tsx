import React from 'react';
import '@components/common/Pagination/Pagination.css';

interface PaginationProps {
    page: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
}

const buildPages = (current: number, totalPages: number): (number | '...')[] => {
    if (totalPages <= 7) {
        return Array.from({length: totalPages}, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) {
        pages.push(i);
    }
    if (current < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
};

/**
 * Pagination control with page numbers and prev/next buttons.
 */
export const Pagination = (
    {page, total, limit, onPageChange}: PaginationProps
): React.JSX.Element | null => {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return null;

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    const pages = buildPages(page, totalPages);

    return (
        <nav className="pagination" aria-label="Pagination">
            <span className="pagination__info">
                Showing {start}–{end} of {total}
            </span>
            <div className="pagination__controls">
                <button
                    type="button"
                    className="pagination__btn"
                    onClick={() => { onPageChange(page - 1); }}
                    disabled={page === 1}
                    aria-label="Previous page"
                >
                    &#8249;
                </button>

                {pages.map((p, i) =>
                    p === '...' ? (
                        <span key={`ellipsis-${i}`} className="pagination__ellipsis">
                            &hellip;
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            className={`pagination__btn ${p === page ? 'pagination__btn--active' : ''}`}
                            onClick={() => { onPageChange(p); }}
                            aria-current={p === page ? 'page' : undefined}
                            aria-label={`Page ${p}`}
                        >
                            {p}
                        </button>
                    )
                )}

                <button
                    type="button"
                    className="pagination__btn"
                    onClick={() => { onPageChange(page + 1); }}
                    disabled={page === totalPages}
                    aria-label="Next page"
                >
                    &#8250;
                </button>
            </div>
        </nav>
    );
};
