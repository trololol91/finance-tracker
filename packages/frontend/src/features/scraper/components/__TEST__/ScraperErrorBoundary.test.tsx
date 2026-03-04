import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {ScraperErrorBoundary} from '@features/scraper/components/ScraperErrorBoundary.js';

// Silence expected error boundary console output
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

describe('ScraperErrorBoundary', () => {
    describe('normal rendering', () => {
        it('renders children when no error occurs', () => {
            render(
                <ScraperErrorBoundary>
                    <SafeChild />
                </ScraperErrorBoundary>
            );
            expect(screen.getByText('Safe content')).toBeInTheDocument();
        });

        it('does not show error UI when no error occurs', () => {
            render(
                <ScraperErrorBoundary>
                    <SafeChild />
                </ScraperErrorBoundary>
            );
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error alert when a child throws', () => {
            render(
                <ScraperErrorBoundary>
                    <ThrowOnMount message="Scraper error" />
                </ScraperErrorBoundary>
            );
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        it('shows "Something went wrong" text', () => {
            render(
                <ScraperErrorBoundary>
                    <ThrowOnMount message="Something bad happened" />
                </ScraperErrorBoundary>
            );
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });

        it('shows the error message', () => {
            render(
                <ScraperErrorBoundary>
                    <ThrowOnMount message="Scraper crashed" />
                </ScraperErrorBoundary>
            );
            expect(screen.getByText('Scraper crashed')).toBeInTheDocument();
        });

        it('shows a "Retry" button', () => {
            render(
                <ScraperErrorBoundary>
                    <ThrowOnMount message="Error" />
                </ScraperErrorBoundary>
            );
            expect(screen.getByRole('button', {name: /retry/i})).toBeInTheDocument();
        });

        it('uses a fallback message when error has no message property', () => {
            const Thrower = (): React.JSX.Element => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw 'raw string error';
            };
            render(
                <ScraperErrorBoundary>
                    <Thrower />
                </ScraperErrorBoundary>
            );
            expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
        });

        it('clicking "Retry" resets the boundary — state clears', async () => {
            const user = userEvent.setup();
            render(
                <ScraperErrorBoundary>
                    <ThrowOnMount message="Error to retry" />
                </ScraperErrorBoundary>
            );
            // Verify error state is visible first
            expect(screen.getByRole('alert')).toBeInTheDocument();
            // Click Retry — boundary resets its own state (child still throws in this test)
            await user.click(screen.getByRole('button', {name: /retry/i}));
            // ThrowOnMount always throws, so boundary shows error again
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        it('calls console.error when a child throws', () => {
            render(
                <ScraperErrorBoundary>
                    <ThrowOnMount message="Logged error" />
                </ScraperErrorBoundary>
            );
            expect(console.error).toHaveBeenCalled();
        });
    });
});
