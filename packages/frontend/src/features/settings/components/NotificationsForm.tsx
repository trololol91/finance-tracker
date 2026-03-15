import React, {
    useState,
    useEffect
} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {useUsersControllerUpdate} from '@/api/users/users.js';
import type {UpdateUserDto} from '@/api/model/updateUserDto.js';
import {Button} from '@components/common/Button/Button.js';
import styles from '@features/settings/components/NotificationsForm.module.css';

export const NotificationsForm = (): React.JSX.Element => {
    const {user: authUser, updateUser} = useAuth();
    const {mutate: updateProfile, isPending: isSaving} = useUsersControllerUpdate();

    const [notifyPush, setNotifyPush] = useState<boolean>(authUser?.notifyPush ?? false);
    const [notifyEmail, setNotifyEmail] = useState<boolean>(authUser?.notifyEmail ?? false);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');

    useEffect((): (() => void) | void => {
        if (!successMessage) return;
        const timer = setTimeout((): void => { setSuccessMessage(''); }, 4000);
        return (): void => { clearTimeout(timer); };
    }, [successMessage]);

    const handleSave = (e: React.FormEvent): void => {
        e.preventDefault();
        if (!authUser) return;

        setApiError('');

        const data: UpdateUserDto = {notifyPush, notifyEmail};

        updateProfile(
            {id: authUser.id, data},
            {
                onSuccess: (updated): void => {
                    updateUser({
                        ...authUser,
                        notifyPush: updated.notifyPush,
                        notifyEmail: updated.notifyEmail
                    });
                    setSuccessMessage('Notification preferences saved.');
                },
                onError: (): void => {
                    setApiError('Failed to save preferences. Please try again.');
                }
            }
        );
    };

    return (
        <form
            className={styles.form}
            onSubmit={handleSave}
            aria-label="Notification preferences"
            noValidate
        >
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Notification Preferences</h2>

                {successMessage !== '' && (
                    <p className={styles.success} role="status">
                        {successMessage}
                    </p>
                )}

                {apiError !== '' && (
                    <p className={styles.apiError} role="alert">
                        {apiError}
                    </p>
                )}

                <div className={styles.toggleRow}>
                    <label className={styles.toggleLabel} htmlFor="notify-push">
                        <span className={styles.toggleText}>
                            <span className={styles.toggleTitle}>Push notifications</span>
                            <span className={styles.toggleDescription}>
                                Receive push notifications for MFA alerts and account activity.
                            </span>
                        </span>
                        <input
                            id="notify-push"
                            type="checkbox"
                            className={styles.checkbox}
                            checked={notifyPush}
                            onChange={(e): void => { setNotifyPush(e.target.checked); }}
                        />
                    </label>
                </div>

                <div className={styles.toggleRow}>
                    <label className={styles.toggleLabel} htmlFor="notify-email">
                        <span className={styles.toggleText}>
                            <span className={styles.toggleTitle}>Email notifications</span>
                            <span className={styles.toggleDescription}>
                                Receive email notifications for MFA alerts and account activity.
                            </span>
                        </span>
                        <input
                            id="notify-email"
                            type="checkbox"
                            className={styles.checkbox}
                            checked={notifyEmail}
                            onChange={(e): void => { setNotifyEmail(e.target.checked); }}
                        />
                    </label>
                </div>
            </section>

            <div className={styles.actions}>
                <Button
                    type="submit"
                    variant="primary"
                    size="small"
                    isLoading={isSaving}
                >
                    Save preferences
                </Button>
            </div>
        </form>
    );
};
