import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@components/common/Button/Button';

describe('Button', () => {
    it('renders with children', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });

    it('applies primary variant by default', () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('button--primary');
    });

    it('applies secondary variant', () => {
        render(<Button variant="secondary">Click me</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('button--secondary');
    });

    it('applies danger variant', () => {
        render(<Button variant="danger">Click me</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('button--danger');
    });

    it('applies medium size by default', () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('button--medium');
    });

    it('applies small size', () => {
        render(<Button size="small">Click me</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('button--small');
    });

    it('applies large size', () => {
        render(<Button size="large">Click me</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('button--large');
    });

    it('shows loading text when loading', () => {
        render(<Button isLoading>Click me</Button>);
        expect(screen.getByRole('button')).toHaveTextContent('Loading...');
    });

    it('disables button when loading', () => {
        render(<Button isLoading>Click me</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('disables button when disabled prop is true', () => {
        render(<Button disabled>Click me</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
