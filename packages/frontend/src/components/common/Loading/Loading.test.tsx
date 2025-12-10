import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading } from '@components/common/Loading/Loading';

describe('Loading', () => {
    it('renders spinner', () => {
        const { container } = render(<Loading />);
        expect(container.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('applies medium size by default', () => {
        const { container } = render(<Loading />);
        const spinner = container.querySelector('.loading-spinner');
        expect(spinner).toHaveClass('loading-spinner--medium');
    });

    it('applies small size', () => {
        const { container } = render(<Loading size="small" />);
        const spinner = container.querySelector('.loading-spinner');
        expect(spinner).toHaveClass('loading-spinner--small');
    });

    it('applies large size', () => {
        const { container } = render(<Loading size="large" />);
        const spinner = container.querySelector('.loading-spinner');
        expect(spinner).toHaveClass('loading-spinner--large');
    });

    it('renders with text', () => {
        render(<Loading text="Loading data..." />);
        expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it('renders without text by default', () => {
        render(<Loading />);
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
});
