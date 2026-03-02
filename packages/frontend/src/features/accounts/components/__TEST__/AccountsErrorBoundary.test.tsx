import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {AccountsErrorBoundary} from '@features/accounts/components/AccountsErrorBoundary.js';

// Silence expected React error boundary console output during these tests
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

const SafeChild = (): React.JSX.Element => (
    <div>Safe content</div>
);

describe('AccountsErrorBoundary', () => {
    describe('normal rendering', () => {
        it('renders children when no error occurs', () => {
            render(
                <AccountsErrorBoundary>
                    <SafeChild />
                </AccountsErrorBoundary>
            );
            expect(screen.getByText('Safe content')).toBeInTheDocument();
        });

        it('does not show error UI when no error occurs', () => {
            render(
                <AccountsErrorBoundary>
                    <SafeChild />
                </AccountsErrorBoundary>
            );
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error alert when a child throws', () => {
            render(
                <AccountsErrorBoundary>
                    <ThrowOnMount message="Test error" />
                </AccountsErrorBoundary>
            );
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        it('shows "Something went wrong" heading', () => {
            render(
                <AccountsErrorBoundary>
                    <ThrowOnMount message="Something bad happened" />
                </AccountsErrorBoundary>
            );
            expect(screen.getByRole('heading', {name: /something went wrong/i})).toBeInTheDocument();
        });

        it('shows the error message', () => {
            render(
                <AccountsErrorBoundary>
                    <ThrowOnMount message="Database unavailable" />
                </AccountsErrorBoundary>
            );
            expect(screen.getByText('Database unavailable')).toBeInTheDocument();
        });

        it('shows "Try again" button', () => {
            render(
                <AccountsErrorBoundary>
                    <ThrowOnMount message="Error" />
                </AccountsErrorBoundary>
            );
            expect(screen.getByRole('button', {name: /try again/i})).toBeInTheDocument();
        });

        it('shows the error message from the thrown Error', () => {
            const ThrowString = (): React.JSX.Element => { throw new Error('string-error'); };
            render(
                <AccountsErrorBoundary>
                    <ThrowString />
                </AccountsErrorBoundary>
            );
            expect(screen.getByText('string-error')).toBeInTheDocument();
        });

        it('shows fallback message for non-Error throws', () => {
            const ThrowNonError = (): React.JSX.Element => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw 'not-an-error-object';
            };
            render(
                <AccountsErrorBoundary>
                    <ThrowNonError />
                </AccountsErrorBoundary>
            );
            expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
        });
    });

    describe('recovery', () => {
        it('clears error state when "Try again" is clicked', async () => {
            // Set up a component that throws on first render but not after state change
            let shouldThrow = true;
            const MaybeThrow = (): React.JSX.Element => {
                if (shouldThrow) throw new Error('Initial error');
                return <div>Recovered</div>;
            };

            const user = userEvent.setup();
            render(
                <AccountsErrorBoundary>
                    <MaybeThrow />
                </AccountsErrorBoundary>
            );

            // Should be in error state
            expect(screen.getByRole('alert')).toBeInTheDocument();

            // Allow recovery
            shouldThrow = false;
            await user.click(screen.getByRole('button', {name: /try again/i}));

            // After clicking Try Again, error boundary resets
            // (children will re-render — if no throw, shows content)
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
});
