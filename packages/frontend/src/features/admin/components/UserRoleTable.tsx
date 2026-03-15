import React, {
    useState,
    useRef,
    useEffect
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useAdminUsersControllerFindAll,
    useAdminUsersControllerUpdateRole,
    getAdminUsersControllerFindAllQueryKey
} from '@/api/admin/admin.js';
import type {AdminUserListItemDto} from '@/api/model/adminUserListItemDto.js';
import {AdminUserListItemDtoRole} from '@/api/model/adminUserListItemDtoRole.js';
import {UpdateUserRoleDtoRole} from '@/api/model/updateUserRoleDtoRole.js';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import styles from '@features/admin/components/UserRoleTable.module.css';

const asString = (value: unknown): string =>
    typeof value === 'string' ? value : '';

interface RowFeedback {
    type: 'success' | 'error';
    message: string;
}

export const UserRoleTable = (): React.JSX.Element => {
    const {user: currentUser} = useAuth();
    const queryClient = useQueryClient();
    const [rowFeedback, setRowFeedback] = useState<Partial<Record<string, RowFeedback>>>({});
    const [pendingRows, setPendingRows] = useState<Partial<Record<string, boolean>>>({});
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return (): void => {
            if (feedbackTimerRef.current !== null) {
                clearTimeout(feedbackTimerRef.current);
            }
        };
    }, []);

    const {data: users, isLoading, isError} = useAdminUsersControllerFindAll();

    const updateRoleMutation = useAdminUsersControllerUpdateRole({
        mutation: {
            onSuccess: (_data, variables) => {
                void queryClient.invalidateQueries({
                    queryKey: getAdminUsersControllerFindAllQueryKey()
                });
                setPendingRows((prev) => {
                    const next = {...prev};
                    delete next[variables.id];
                    return next;
                });
                setRowFeedback((prev) => ({
                    ...prev,
                    [variables.id]: {type: 'success', message: 'Role updated'}
                }));
                // Clear feedback after 3 seconds
                if (feedbackTimerRef.current !== null) {
                    clearTimeout(feedbackTimerRef.current);
                }
                feedbackTimerRef.current = setTimeout(() => {
                    setRowFeedback((prev) => {
                        const next = {...prev};
                        delete next[variables.id];
                        return next;
                    });
                }, 3000);
            },
            onError: (_error, variables) => {
                setPendingRows((prev) => {
                    const next = {...prev};
                    delete next[variables.id];
                    return next;
                });
                setRowFeedback((prev) => ({
                    ...prev,
                    [variables.id]: {type: 'error', message: 'Failed to update role'}
                }));
                console.error('[Admin] UserRoleTable: role update failed for user', variables.id);
            }
        }
    });

    const handleRoleChange = (user: AdminUserListItemDto, newRole: string): void => {
        if (newRole !== UpdateUserRoleDtoRole.USER && newRole !== UpdateUserRoleDtoRole.ADMIN) {
            return;
        }
        setPendingRows((prev) => ({...prev, [user.id]: true}));
        setRowFeedback((prev) => {
            const next = {...prev};
            delete next[user.id];
            return next;
        });
        updateRoleMutation.mutate({
            id: user.id,
            data: {role: newRole}
        });
    };

    if (isLoading) {
        return (
            <div className={styles.centered} aria-live="polite" aria-busy="true">
                <p className={styles.message}>Loading users…</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className={styles.centered} role="alert">
                <p className={`${styles.message} ${styles.messageError}`}>
                    Failed to load users. Please try again.
                </p>
            </div>
        );
    }

    if (!users || users.length === 0) {
        return (
            <div className={styles.centered}>
                <p className={styles.message}>No users found.</p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="User management">
                <thead>
                    <tr>
                        <th scope="col" className={styles.th}>Name</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Email</th>
                        <th scope="col" className={styles.th}>Role</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Status</th>
                        <th scope="col" className={styles.th}>
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => {
                        const isSelf = currentUser?.id === user.id;
                        const isPending = pendingRows[user.id] ?? false;
                        const feedback = rowFeedback[user.id];
                        // firstName/lastName DTO type is `{ [key: string]: unknown } | null`
                        // In practice the API returns strings; asString guards non-string values
                        const firstName = asString(user.firstName);
                        const lastName = asString(user.lastName);
                        const displayName = [firstName, lastName].filter(Boolean).join(' ') || user.email;

                        return (
                            <tr
                                key={user.id}
                                className={`${styles.row} ${isSelf ? styles.rowSelf : ''}`}
                            >
                                <td className={styles.td}>
                                    <span className={styles.nameCell}>{displayName}</span>
                                    {isSelf && (
                                        <span
                                            aria-label="This is you"
                                            title="This is you"
                                            style={{
                                                marginLeft: '0.5rem',
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--color-text-secondary)'
                                            }}
                                        >
                                            (you)
                                        </span>
                                    )}
                                </td>
                                <td className={`${styles.td} ${styles.hideOnMobile} ${styles.emailCell}`}>
                                    {user.email}
                                </td>
                                <td className={styles.td}>
                                    <select
                                        className={styles.roleSelect}
                                        value={user.role}
                                        disabled={isSelf || isPending}
                                        aria-label={`Role for ${displayName}`}
                                        onChange={(e) => {
                                            handleRoleChange(user, e.target.value);
                                        }}
                                    >
                                        <option value={AdminUserListItemDtoRole.USER}>
                                            User
                                        </option>
                                        <option value={AdminUserListItemDtoRole.ADMIN}>
                                            Admin
                                        </option>
                                    </select>
                                </td>
                                <td className={`${styles.td} ${styles.hideOnMobile}`}>
                                    {user.isActive
                                        ? <span className={styles.activeTag}>Active</span>
                                        : <span className={styles.inactiveTag}>Inactive</span>}
                                </td>
                                <td className={`${styles.td} ${styles.feedbackCell}`}>
                                    {isPending && (
                                        <span aria-live="polite" aria-busy="true">
                                            Saving…
                                        </span>
                                    )}
                                    {!isPending && feedback !== undefined && (
                                        <span
                                            aria-live="polite"
                                            className={
                                                feedback.type === 'success'
                                                    ? styles.feedbackSuccess
                                                    : styles.feedbackError
                                            }
                                        >
                                            {feedback.message}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
