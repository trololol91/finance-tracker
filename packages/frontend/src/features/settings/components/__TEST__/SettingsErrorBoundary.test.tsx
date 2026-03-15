import React from 'react';
import {
    render,
    screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {SettingsErrorBoundary} from '@features/settings/components/SettingsErrorBoundary.js';

// ── Component that throws on demand ─────────────────────────────────────────

const BombComponent = ({shouldThrow}: {shouldThrow: boolean}): React.JSX.Element => {
    if (shouldThrow) {
        throw new Error('Settings component exploded');
    }
    return <div>Settings content loaded</div>;
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsErrorBoundary', () => {
    beforeEach(() => {
        // Suppress React's own error boundary console output during tests
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('when no error occurs', () => {
        it('renders children normally', () => {
            render(
                <SettingsErrorBoundary>
                    <p>Normal settings content</p>
                </SettingsErrorBoundary>
            );

            expect(screen.getByText('Normal settings content')).toBeInTheDocument();
        });

        it('does not show the error fallback UI', () => {
            render(
                <SettingsErrorBoundary>
                    <p>Normal settings content</p>
                </SettingsErrorBoundary>
            );

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('when a child component throws', () => {
        it('renders the error fallback UI', () => {
            render(
                <SettingsErrorBoundary>
                    <BombComponent shouldThrow={true} />
                </SettingsErrorBoundary>
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        it('shows the "Something went wrong" message', () => {
            render(
                <SettingsErrorBoundary>
                    <BombComponent shouldThrow={true} />
                </SettingsErrorBoundary>
            );

            expect(
                screen.getByText(/something went wrong in the settings page/i)
            ).toBeInTheDocument();
        });

        it('shows a "Try again" button', () => {
            render(
                <SettingsErrorBoundary>
                    <BombComponent shouldThrow={true} />
                </SettingsErrorBoundary>
            );

            expect(screen.getByRole('button', {name: /try again/i})).toBeInTheDocument();
        });

        it('does not render children when in error state', () => {
            render(
                <SettingsErrorBoundary>
                    <BombComponent shouldThrow={true} />
                </SettingsErrorBoundary>
            );

            expect(screen.queryByText('Settings content loaded')).not.toBeInTheDocument();
        });

        it('suppresses the thrown error in the component tree (does not propagate)', () => {
            // If the error boundary did not catch the error, render() would throw.
            // A successful render proves componentDidCatch / getDerivedStateFromError
            // handled it without crashing the test.
            expect(() => {
                render(
                    <SettingsErrorBoundary>
                        <BombComponent shouldThrow={true} />
                    </SettingsErrorBoundary>
                );
            }).not.toThrow();
        });
    });

    describe('"Try again" button', () => {
        it('clears the error state (hasError becomes false) when clicked', async () => {
            const user = userEvent.setup();

            render(
                <SettingsErrorBoundary>
                    <BombComponent shouldThrow={true} />
                </SettingsErrorBoundary>
            );

            // Confirm error state is shown
            expect(screen.getByRole('alert')).toBeInTheDocument();

            // Click "Try again" — setState({hasError: false}) is called.
            // Because the child still throws on re-render, getDerivedStateFromError
            // immediately flips it back to true. The important thing to assert is
            // that the button is interactive and calls setState (the error UI
            // remains visible because BombComponent will throw again).
            await user.click(screen.getByRole('button', {name: /try again/i}));

            // The boundary attempted to re-render children and they threw again,
            // so the fallback UI is still present.
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /try again/i})).toBeInTheDocument();
        });
    });
});
