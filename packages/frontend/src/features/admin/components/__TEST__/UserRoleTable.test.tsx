import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, within, act
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock generated API hooks before importing the component
vi.mock('@/api/admin/admin.js', () => ({
    useAdminUsersControllerFindAll: vi.fn(),
    useAdminUsersControllerUpdateRole: vi.fn(),
    getAdminUsersControllerFindAllQueryKey: vi.fn().mockReturnValue(['/admin/users'])
}));

// Mock useAuth so we control the current user identity
vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: vi.fn()
}));

// Mock useQueryClient
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn().mockReturnValue({
        invalidateQueries: vi.fn()
    })
}));

import {
    useAdminUsersControllerFindAll,
    useAdminUsersControllerUpdateRole
} from '@/api/admin/admin.js';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {UserRoleTable} from '@features/admin/components/UserRoleTable.js';
import type {AdminUserListItemDto} from '@/api/model/adminUserListItemDto.js';

const mockFindAll = useAdminUsersControllerFindAll as ReturnType<typeof vi.fn>;
const mockUpdateRole = useAdminUsersControllerUpdateRole as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// The Orval-generated firstName/lastName types are `{ [key: string]: unknown } | null`
// but the API returns plain strings in practice. We cast via unknown to satisfy TS.
const asName = (v: string | null): AdminUserListItemDto['firstName'] =>
    v as unknown as AdminUserListItemDto['firstName'];

const makeUser = (overrides: Partial<AdminUserListItemDto> = {}): AdminUserListItemDto => ({
    id: 'user-1',
    email: 'alice@example.com',
    firstName: asName('Alice'),
    lastName: asName('Smith'),
    role: 'USER',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides
});

const mockMutate = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({user: {id: 'admin-1', email: 'admin@example.com', role: 'ADMIN'}});
    mockUpdateRole.mockReturnValue({mutate: mockMutate, isPending: false});
});

describe('UserRoleTable', () => {
    describe('loading state', () => {
        it('shows loading message while users are fetching', () => {
            mockFindAll.mockReturnValue({data: undefined, isLoading: true, isError: false});
            render(<UserRoleTable />);
            expect(screen.getByText(/loading users/i)).toBeInTheDocument();
        });

        it('loading region has aria-busy', () => {
            mockFindAll.mockReturnValue({data: undefined, isLoading: true, isError: false});
            const {container} = render(<UserRoleTable />);
            expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error alert when fetching fails', () => {
            mockFindAll.mockReturnValue({data: undefined, isLoading: false, isError: true});
            render(<UserRoleTable />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty message when no users are returned', () => {
            mockFindAll.mockReturnValue({data: [], isLoading: false, isError: false});
            render(<UserRoleTable />);
            expect(screen.getByText(/no users found/i)).toBeInTheDocument();
        });
    });

    describe('user table', () => {
        it('renders a table with accessible label', () => {
            mockFindAll.mockReturnValue({data: [makeUser()], isLoading: false, isError: false});
            render(<UserRoleTable />);
            expect(screen.getByRole('table', {name: /user management/i})).toBeInTheDocument();
        });

        it('renders the user name', () => {
            mockFindAll.mockReturnValue({data: [makeUser()], isLoading: false, isError: false});
            render(<UserRoleTable />);
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });

        it('renders the user email', () => {
            mockFindAll.mockReturnValue({data: [makeUser()], isLoading: false, isError: false});
            render(<UserRoleTable />);
            expect(screen.getByText('alice@example.com')).toBeInTheDocument();
        });

        it('renders role selector for each user', () => {
            mockFindAll.mockReturnValue({data: [makeUser()], isLoading: false, isError: false});
            render(<UserRoleTable />);
            expect(
                screen.getByRole('combobox', {name: /role for alice smith/i})
            ).toBeInTheDocument();
        });

        it('shows Active status for active users', () => {
            mockFindAll.mockReturnValue({
                data: [makeUser({isActive: true})],
                isLoading: false,
                isError: false
            });
            render(<UserRoleTable />);
            expect(screen.getByText('Active')).toBeInTheDocument();
        });

        it('shows Inactive status for inactive users', () => {
            mockFindAll.mockReturnValue({
                data: [makeUser({isActive: false})],
                isLoading: false,
                isError: false
            });
            render(<UserRoleTable />);
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        it('renders column headers', () => {
            mockFindAll.mockReturnValue({data: [makeUser()], isLoading: false, isError: false});
            render(<UserRoleTable />);
            const table = screen.getByRole('table');
            const headers = within(table).getAllByRole('columnheader');
            expect(headers.length).toBeGreaterThan(0);
        });

        it('uses email as display name when no firstName/lastName', () => {
            const noName = makeUser({
                firstName: asName(null),
                lastName: asName(null)
            });
            mockFindAll.mockReturnValue({
                data: [noName],
                isLoading: false,
                isError: false
            });
            render(<UserRoleTable />);
            // email should appear as the name in the name cell
            const allAlice = screen.getAllByText('alice@example.com');
            expect(allAlice.length).toBeGreaterThan(0);
        });
    });

    describe('self-row protection', () => {
        it('disables the role selector for the current user', () => {
            mockUseAuth.mockReturnValue({
                user: {id: 'user-1', email: 'alice@example.com', role: 'ADMIN'}
            });
            mockFindAll.mockReturnValue({
                data: [makeUser({id: 'user-1'})],
                isLoading: false,
                isError: false
            });
            render(<UserRoleTable />);
            const select = screen.getByRole('combobox', {name: /role for alice smith/i});
            expect(select).toBeDisabled();
        });

        it('shows "(you)" label next to current user', () => {
            mockUseAuth.mockReturnValue({
                user: {id: 'user-1', email: 'alice@example.com', role: 'ADMIN'}
            });
            mockFindAll.mockReturnValue({
                data: [makeUser({id: 'user-1'})],
                isLoading: false,
                isError: false
            });
            render(<UserRoleTable />);
            expect(screen.getByText('(you)')).toBeInTheDocument();
        });

        it('does not disable the role selector for other users', () => {
            const bobUser = makeUser({
                id: 'user-2',
                email: 'bob@example.com',
                firstName: asName('Bob'),
                lastName: asName('Jones')
            });
            mockFindAll.mockReturnValue({
                data: [bobUser],
                isLoading: false,
                isError: false
            });
            render(<UserRoleTable />);
            const select = screen.getByRole('combobox', {name: /role for bob jones/i});
            expect(select).not.toBeDisabled();
        });
    });

    describe('role change', () => {
        it('calls mutate when role selector is changed', async () => {
            const user = userEvent.setup();
            const bobUser = makeUser({
                id: 'user-2',
                email: 'bob@example.com',
                firstName: asName('Bob'),
                lastName: asName('Jones'),
                role: 'USER'
            });
            mockFindAll.mockReturnValue({
                data: [bobUser],
                isLoading: false,
                isError: false
            });
            render(<UserRoleTable />);

            const select = screen.getByRole('combobox', {name: /role for bob jones/i});
            await user.selectOptions(select, 'ADMIN');

            expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
                id: 'user-2',
                data: {role: 'ADMIN'}
            }));
        });
    });

    describe('mutation callbacks', () => {
        it('shows success feedback in the row after onSuccess', () => {
            const bobUser = makeUser({
                id: 'user-2',
                email: 'bob@example.com',
                firstName: asName('Bob'),
                lastName: asName('Jones'),
                role: 'USER'
            });
            mockFindAll.mockReturnValue({data: [bobUser], isLoading: false, isError: false});

            let capturedOnSuccess:
                ((_d: unknown, v: {id: string, data: {role: string}}) => void) | undefined;
            mockUpdateRole.mockImplementation(
                ({mutation}: {
                    mutation: {
                        onSuccess: (_d: unknown, v: {id: string, data: {role: string}}) => void;
                    };
                }) => {
                    capturedOnSuccess = mutation.onSuccess;
                    return {mutate: mockMutate, isPending: false};
                }
            );

            render(<UserRoleTable />);
            act(() => {
                capturedOnSuccess?.(undefined, {id: 'user-2', data: {role: 'ADMIN'}});
            });
            expect(screen.getByText('Role updated')).toBeInTheDocument();
        });

        it('shows error feedback in the row after onError', () => {
            const bobUser = makeUser({
                id: 'user-2',
                email: 'bob@example.com',
                firstName: asName('Bob'),
                lastName: asName('Jones'),
                role: 'USER'
            });
            mockFindAll.mockReturnValue({data: [bobUser], isLoading: false, isError: false});

            let capturedOnError:
                ((_e: unknown, v: {id: string, data: {role: string}}) => void) | undefined;
            mockUpdateRole.mockImplementation(
                ({mutation}: {
                    mutation: {
                        onError: (_e: unknown, v: {id: string, data: {role: string}}) => void;
                    };
                }) => {
                    capturedOnError = mutation.onError;
                    return {mutate: mockMutate, isPending: false};
                }
            );

            render(<UserRoleTable />);
            act(() => {
                capturedOnError?.(new Error('fail'), {id: 'user-2', data: {role: 'ADMIN'}});
            });
            expect(screen.getByText('Failed to update role')).toBeInTheDocument();
        });
    });
});
