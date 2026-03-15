import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {DashboardErrorBoundary} from '@features/dashboard/components/DashboardErrorBoundary.js';

const originalError = console.error.bind(console);
beforeEach(() => {
    console.error = vi.fn();
});
afterEach(() => {
    console.error = originalError;
});

const ThrowOnMount = ({message}: {message: string}): React.JSX.Element => {
    throw new Error(message);
};

const SafeChild = (): React.JSX.Element => <div>Safe content</div>;

describe('DashboardErrorBoundary', () => {
    it('renders children when no error occurs', () => {
        render(
            <DashboardErrorBoundary>
                <SafeChild />
            </DashboardErrorBoundary>
        );
        expect(screen.getByText('Safe content')).toBeInTheDocument();
    });

    it('shows error alert when a child throws', () => {
        render(
            <DashboardErrorBoundary>
                <ThrowOnMount message="Test error" />
            </DashboardErrorBoundary>
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows "Something went wrong" heading', () => {
        render(
            <DashboardErrorBoundary>
                <ThrowOnMount message="Dashboard failure" />
            </DashboardErrorBoundary>
        );
        expect(screen.getByRole('heading', {name: /something went wrong/i})).toBeInTheDocument();
    });

    it('shows the error message text', () => {
        render(
            <DashboardErrorBoundary>
                <ThrowOnMount message="Data fetch failed" />
            </DashboardErrorBoundary>
        );
        expect(screen.getByText('Data fetch failed')).toBeInTheDocument();
    });

    it('shows a "Try again" button', () => {
        render(
            <DashboardErrorBoundary>
                <ThrowOnMount message="Error" />
            </DashboardErrorBoundary>
        );
        expect(screen.getByRole('button', {name: /try again/i})).toBeInTheDocument();
    });

    it('clears error state when "Try again" is clicked', async () => {
        let shouldThrow = true;
        const MaybeThrow = (): React.JSX.Element => {
            if (shouldThrow) throw new Error('Initial error');
            return <div>Recovered</div>;
        };

        const user = userEvent.setup();
        render(
            <DashboardErrorBoundary>
                <MaybeThrow />
            </DashboardErrorBoundary>
        );

        expect(screen.getByRole('alert')).toBeInTheDocument();
        shouldThrow = false;
        await user.click(screen.getByRole('button', {name: /try again/i}));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows fallback message when a non-Error value is thrown', () => {
        // Throw a plain object (not an Error instance) to exercise the fallback branch.
        // We disable the lint rule locally because throwing a non-Error is intentional here.
        const ThrowObject = (): React.JSX.Element => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw {code: 42, reason: 'non-error object'};
        };
        render(
            <DashboardErrorBoundary>
                <ThrowObject />
            </DashboardErrorBoundary>
        );
        expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });
});
