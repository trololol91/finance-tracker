import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, act
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock generated API hooks before importing the component
vi.mock('@/api/admin/admin.js', () => ({
    useScraperAdminControllerReload: vi.fn(),
    useScraperAdminControllerInstall: vi.fn()
}));

import {
    useScraperAdminControllerReload,
    useScraperAdminControllerInstall
} from '@/api/admin/admin.js';
import {PluginManager} from '@features/admin/components/PluginManager.js';

const mockReload = useScraperAdminControllerReload as ReturnType<typeof vi.fn>;
const mockInstall = useScraperAdminControllerInstall as ReturnType<typeof vi.fn>;

const mockReloadMutate = vi.fn();
const mockInstallMutate = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    mockReload.mockReturnValue({mutate: mockReloadMutate, isPending: false});
    mockInstall.mockReturnValue({mutate: mockInstallMutate, isPending: false});
});

describe('PluginManager', () => {
    describe('layout', () => {
        it('renders the Reload Plugins section', () => {
            render(<PluginManager />);
            expect(screen.getByRole('region', {name: /reload plugins/i})).toBeInTheDocument();
        });

        it('renders the Install Plugin section', () => {
            render(<PluginManager />);
            expect(screen.getByRole('region', {name: /install plugin/i})).toBeInTheDocument();
        });

        it('renders the Reload Plugins button', () => {
            render(<PluginManager />);
            expect(screen.getByRole('button', {name: /reload plugins/i})).toBeInTheDocument();
        });

        it('renders the Install Plugin button', () => {
            render(<PluginManager />);
            expect(screen.getByRole('button', {name: /install plugin/i})).toBeInTheDocument();
        });

        it('renders a file input', () => {
            render(<PluginManager />);
            expect(screen.getByLabelText(/select a .zip plugin file/i)).toBeInTheDocument();
        });
    });

    describe('reload plugins', () => {
        it('calls reload mutate when Reload Plugins button is clicked', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            await user.click(screen.getByRole('button', {name: /reload plugins/i}));
            expect(mockReloadMutate).toHaveBeenCalledOnce();
        });

        it('disables Reload Plugins button while pending', () => {
            mockReload.mockReturnValue({mutate: mockReloadMutate, isPending: true});
            render(<PluginManager />);
            expect(screen.getByRole('button', {name: /reloading/i})).toBeDisabled();
        });

        it('shows loading text on button while reload is pending', () => {
            mockReload.mockReturnValue({mutate: mockReloadMutate, isPending: true});
            render(<PluginManager />);
            expect(screen.getByRole('button', {name: /reloading/i})).toBeInTheDocument();
        });
    });

    describe('install plugin', () => {
        it('shows error feedback when no file is selected and Install is clicked', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            await user.click(screen.getByRole('button', {name: /install plugin/i}));
            expect(screen.getByText(/please select a .zip plugin file/i)).toBeInTheDocument();
        });

        it('does not call install mutate when no file is selected', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            await user.click(screen.getByRole('button', {name: /install plugin/i}));
            expect(mockInstallMutate).not.toHaveBeenCalled();
        });

        it('disables Install Plugin button while pending', () => {
            mockInstall.mockReturnValue({mutate: mockInstallMutate, isPending: true});
            render(<PluginManager />);
            expect(screen.getByRole('button', {name: /installing/i})).toBeDisabled();
        });
    });

    describe('reload mutation callbacks', () => {
        it('shows success feedback when reload onSuccess fires with a message', () => {
            let capturedOnSuccess: ((d: {message: string}) => void) | undefined;
            mockReload.mockImplementation(
                ({mutation}: {mutation: {onSuccess: (d: {message: string}) => void}}) => {
                    capturedOnSuccess = mutation.onSuccess;
                    return {mutate: mockReloadMutate, isPending: false};
                }
            );
            render(<PluginManager />);
            act(() => { capturedOnSuccess?.({message: 'All good'}); });
            expect(screen.getByText('All good')).toBeInTheDocument();
        });

        it('uses fallback when reload onSuccess fires with empty message', () => {
            let capturedOnSuccess: ((d: {message: string}) => void) | undefined;
            mockReload.mockImplementation(
                ({mutation}: {mutation: {onSuccess: (d: {message: string}) => void}}) => {
                    capturedOnSuccess = mutation.onSuccess;
                    return {mutate: mockReloadMutate, isPending: false};
                }
            );
            render(<PluginManager />);
            act(() => { capturedOnSuccess?.({message: ''}); });
            expect(screen.getByText(/reloaded successfully/i)).toBeInTheDocument();
        });

        it('shows error feedback when reload onError fires', () => {
            let capturedOnError: (() => void) | undefined;
            mockReload.mockImplementation(
                ({mutation}: {mutation: {onError: () => void}}) => {
                    capturedOnError = mutation.onError;
                    return {mutate: mockReloadMutate, isPending: false};
                }
            );
            render(<PluginManager />);
            act(() => { capturedOnError?.(); });
            expect(screen.getByText(/failed to reload plugins/i)).toBeInTheDocument();
        });
    });

    describe('install mutation callbacks', () => {
        it('shows success feedback when install onSuccess fires with a message', () => {
            let capturedSuccess: ((d: {message: string, bankId: string}) => void) | undefined;
            mockInstall.mockImplementation(
                ({mutation}: {
                    mutation: {onSuccess: (d: {message: string, bankId: string}) => void};
                }) => {
                    capturedSuccess = mutation.onSuccess;
                    return {mutate: mockInstallMutate, isPending: false};
                }
            );
            render(<PluginManager />);
            act(() => { capturedSuccess?.({message: 'Installed!', bankId: 'cibc'}); });
            expect(screen.getByText('Installed!')).toBeInTheDocument();
        });

        it('uses bankId fallback when install onSuccess fires with empty message', () => {
            let capturedSuccess: ((d: {message: string, bankId: string}) => void) | undefined;
            mockInstall.mockImplementation(
                ({mutation}: {
                    mutation: {onSuccess: (d: {message: string, bankId: string}) => void};
                }) => {
                    capturedSuccess = mutation.onSuccess;
                    return {mutate: mockInstallMutate, isPending: false};
                }
            );
            render(<PluginManager />);
            act(() => { capturedSuccess?.({message: '', bankId: 'my-bank'}); });
            expect(screen.getByText(/my-bank/i)).toBeInTheDocument();
        });

        it('shows error feedback when install onError fires', () => {
            let capturedOnError: (() => void) | undefined;
            mockInstall.mockImplementation(
                ({mutation}: {mutation: {onError: () => void}}) => {
                    capturedOnError = mutation.onError;
                    return {mutate: mockInstallMutate, isPending: false};
                }
            );
            render(<PluginManager />);
            act(() => { capturedOnError?.(); });
            expect(screen.getByText(/failed to install plugin/i)).toBeInTheDocument();
        });
    });
});
