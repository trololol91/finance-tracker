import React from 'react';
import {
    render,
    screen
} from '@testing-library/react';
import {
    MemoryRouter,
    Route,
    Routes
} from 'react-router-dom';
import {
    describe,
    it,
    expect,
    vi
} from 'vitest';
import {AppShell} from '@components/layout/AppShell/AppShell.js';

// ── Mock Sidebar so AppShell tests are isolated ──────────────────────────────

vi.mock('@components/layout/Sidebar/Sidebar.js', () => ({
    Sidebar: () => <nav data-testid="sidebar">Sidebar</nav>
}));

// ── Mock AppShell CSS module ─────────────────────────────────────────────────

vi.mock('@components/layout/AppShell/AppShell.module.css', () => ({
    default: new Proxy(
        {},
        {get: (_target, prop: string) => prop}
    )
}));

// ── Helper ───────────────────────────────────────────────────────────────────

const renderAppShell = (childContent: React.ReactNode = null) => render(
    <MemoryRouter initialEntries={['/']}>
        <Routes>
            <Route element={<AppShell />}>
                <Route index element={childContent} />
            </Route>
        </Routes>
    </MemoryRouter>
);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AppShell', () => {
    describe('structure', () => {
        it('renders the Sidebar', () => {
            renderAppShell();

            expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });

        it('renders a main element', () => {
            renderAppShell();

            expect(screen.getByRole('main')).toBeInTheDocument();
        });

        it('renders child route content via Outlet', () => {
            renderAppShell(<p>Child content</p>);

            expect(screen.getByText('Child content')).toBeInTheDocument();
        });

        it('renders child content inside the main element', () => {
            renderAppShell(<span>Inside main</span>);

            const main = screen.getByRole('main');
            expect(main).toContainElement(screen.getByText('Inside main'));
        });
    });

    describe('layout composition', () => {
        it('renders Sidebar and main as siblings inside the shell', () => {
            renderAppShell();

            const sidebar = screen.getByTestId('sidebar');
            const main = screen.getByRole('main');

            // Both should share the same parent container
            expect(sidebar.parentElement).toBe(main.parentElement);
        });
    });
});
