import {
    describe, it, expect
} from 'vitest';
import React from 'react';
import {
    render, screen
} from '@testing-library/react';
import {Input} from '@components/common/Input/Input';

describe('Input', () => {
    it('renders without label', () => {
        render(<Input placeholder="Enter text" />);
        expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with label', () => {
        render(<Input label="Username" />);
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('displays error message', () => {
        render(<Input error="This field is required" />);
        expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error class when error is present', () => {
        render(<Input error="Error message" />);
        const input = screen.getByRole('textbox');
        expect(input).toHaveClass('input--error');
    });

    it('associates label with input via htmlFor', () => {
        render(<Input label="Email" id="email-input" />);
        const label = screen.getByText('Email');
        const input = screen.getByLabelText('Email');
        expect(label).toHaveAttribute('for', 'email-input');
        expect(input).toHaveAttribute('id', 'email-input');
    });

    it('disables input when disabled prop is true', () => {
        render(<Input disabled />);
        expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('forwards a ref to the underlying input element', () => {
        const ref = React.createRef<HTMLInputElement>();
        render(<Input ref={ref} placeholder="ref-test" />);
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
        expect(ref.current).toBe(screen.getByPlaceholderText('ref-test'));
    });
});
