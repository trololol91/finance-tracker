import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {AdminErrorBoundary} from '@features/admin/components/AdminErrorBoundary.js';

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

describe('AdminErrorBoundary', () => {
    describe('normal rendering', () => {
        it('renders children when no error occurs', () => {
            render(
                <AdminErrorBoundary>
                    <SafeChild />
                </AdminErrorBoundary>
            );
            expect(screen.getByText('Safe content')).toBeInTheDocument();
        });

        it('does not show error UI when no error occurs', () => {
            render(
                <AdminErrorBoundary>
                    <SafeChild />
                </AdminErrorBoundary>
            );
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error alert when a child throws', () => {
            render(
                <AdminErrorBoundary>
                    <ThrowOnMount message="Test error" />
                </AdminErrorBoundary>
            );
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        it('shows "Something went wrong" heading', () => {
            render(
                <AdminErrorBoundary>
                    <ThrowOnMount message="Something bad happened" />
                </AdminErrorBoundary>
            );
            expect(screen.getByRole('heading', {name: /something went wrong/i})).toBeInTheDocument();
        });

        it('shows the error message', () => {
            render(
                <AdminErrorBoundary>
                    <ThrowOnMount message="Database unavailable" />
                </AdminErrorBoundary>
            );
            expect(screen.getByText('Database unavailable')).toBeInTheDocument();
        });

        it('shows "Try again" button', () => {
            render(
                <AdminErrorBoundary>
                    <ThrowOnMount message="Error" />
                </AdminErrorBoundary>
            );
            expect(screen.getByRole('button', {name: /try again/i})).toBeInTheDocument();
        });

        it('shows fallback message for non-Error throws', () => {
            const ThrowNonError = (): React.JSX.Element => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw 'not-an-error-object';
            };
            render(
                <AdminErrorBoundary>
                    <ThrowNonError />
                </AdminErrorBoundary>
            );
            expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
        });
    });

    describe('recovery', () => {
        it('clears error state when "Try again" is clicked', async () => {
            let shouldThrow = true;
            const MaybeThrow = (): React.JSX.Element => {
                if (shouldThrow) throw new Error('Initial error');
                return <div>Recovered</div>;
            };

            const user = userEvent.setup();
            render(
                <AdminErrorBoundary>
                    <MaybeThrow />
                </AdminErrorBoundary>
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();

            shouldThrow = false;
            await user.click(screen.getByRole('button', {name: /try again/i}));

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
});
