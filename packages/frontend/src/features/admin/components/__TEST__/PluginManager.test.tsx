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

        it('renders the Choose file trigger', () => {
            render(<PluginManager />);
            expect(screen.getByText(/choose file/i)).toBeInTheDocument();
        });

        it('shows No file selected when no file is chosen', () => {
            render(<PluginManager />);
            expect(screen.getByText(/no file selected/i)).toBeInTheDocument();
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
        it('disables Install Plugin button when no file is selected', () => {
            render(<PluginManager />);
            expect(screen.getByRole('button', {name: /install plugin/i})).toBeDisabled();
        });

        it('does not call install mutate when no file is selected', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            await user.click(screen.getByRole('button', {name: /install plugin/i}));
            expect(mockInstallMutate).not.toHaveBeenCalled();
        });

        it('enables Install Plugin button after a file is selected', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            const input = screen.getByLabelText(/select a .zip plugin file/i);
            const file = new File(['content'], 'test-plugin.zip', {type: 'application/zip'});
            await user.upload(input, file);
            expect(screen.getByRole('button', {name: /install plugin/i})).not.toBeDisabled();
        });

        it('shows the filename after a file is selected', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            const input = screen.getByLabelText(/select a .zip plugin file/i);
            const file = new File(['content'], 'my-bank.zip', {type: 'application/zip'});
            await user.upload(input, file);
            expect(screen.getByText('my-bank.zip')).toBeInTheDocument();
        });

        it('shows a clear button after a file is selected', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            const input = screen.getByLabelText(/select a .zip plugin file/i);
            const file = new File(['content'], 'test.zip', {type: 'application/zip'});
            await user.upload(input, file);
            expect(screen.getByRole('button', {name: /clear selected file/i})).toBeInTheDocument();
        });

        it('clears the selected file when the clear button is clicked', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            const input = screen.getByLabelText(/select a .zip plugin file/i);
            const file = new File(['content'], 'test.zip', {type: 'application/zip'});
            await user.upload(input, file);
            await user.click(screen.getByRole('button', {name: /clear selected file/i}));
            expect(screen.getByText(/no file selected/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /install plugin/i})).toBeDisabled();
        });

        it('clears install feedback when the clear button is clicked', async () => {
            let capturedOnError: (() => void) | undefined;
            mockInstall.mockImplementation(
                ({mutation}: {mutation: {onError: () => void}}) => {
                    capturedOnError = mutation.onError;
                    return {mutate: mockInstallMutate, isPending: false};
                }
            );
            const user = userEvent.setup();
            render(<PluginManager />);
            const input = screen.getByLabelText(/select a .zip plugin file/i);
            const file = new File(['content'], 'test.zip', {type: 'application/zip'});
            await user.upload(input, file);
            await user.click(screen.getByRole('button', {name: /install plugin/i}));
            act(() => { capturedOnError?.(); });
            expect(screen.getByText(/failed to install plugin/i)).toBeInTheDocument();
            await user.upload(input, file);
            await user.click(screen.getByRole('button', {name: /clear selected file/i}));
            expect(screen.queryByText(/failed to install plugin/i)).not.toBeInTheDocument();
        });

        it('calls install mutate with the selected file', async () => {
            const user = userEvent.setup();
            render(<PluginManager />);
            const input = screen.getByLabelText(/select a .zip plugin file/i);
            const file = new File(['content'], 'plugin.zip', {type: 'application/zip'});
            await user.upload(input, file);
            await user.click(screen.getByRole('button', {name: /install plugin/i}));
            expect(mockInstallMutate).toHaveBeenCalledWith({data: {file}});
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
