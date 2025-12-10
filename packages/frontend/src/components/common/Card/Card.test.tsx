import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '@components/common/Card/Card';

describe('Card', () => {
    it('renders children', () => {
        render(<Card>Card content</Card>);
        expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with title', () => {
        render(<Card title="Card Title">Content</Card>);
        expect(screen.getByText('Card Title')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders without title', () => {
        render(<Card>Content only</Card>);
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        expect(screen.getByText('Content only')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<Card className="custom-class">Content</Card>);
        expect(container.firstChild).toHaveClass('card');
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
