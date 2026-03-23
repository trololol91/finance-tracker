import React, {
    useState,
    useEffect
} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {useUsersControllerUpdate} from '@/api/users/users.js';
import {
    usePushControllerSubscribe,
    usePushControllerUnsubscribe
} from '@/api/push/push.js';
import type {UpdateUserDto} from '@/api/model/updateUserDto.js';
import type {
    SubscribePushDto,
    UnsubscribePushDto
} from '@/api/model/index.js';
import {Button} from '@components/common/Button/Button.js';
import {env} from '@config/env.js';
import {
    subscribeBrowser,
    unsubscribeBrowser,
    getCurrentSubscription
} from '@services/push/pushSubscription.js';
import styles from '@features/settings/components/NotificationsForm.module.css';

/** Encode an ArrayBuffer key to a base64 string for the backend DTO. */
const encodeKey = (buf: ArrayBuffer): string =>
    btoa(String.fromCharCode(...new Uint8Array(buf)));

export const NotificationsForm = (): React.JSX.Element => {
    const {user: authUser, updateUser} = useAuth();
    const {mutate: updateProfile, isPending: isSaving} = useUsersControllerUpdate();
    const {mutate: mutateSubscribe} = usePushControllerSubscribe();
    const {mutate: mutateUnsubscribe} = usePushControllerUnsubscribe();

    const [notifyPush, setNotifyPush] = useState<boolean>(authUser?.notifyPush ?? false);
    const [notifyEmail, setNotifyEmail] = useState<boolean>(authUser?.notifyEmail ?? false);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');
    const [pushWarning, setPushWarning] = useState<string>('');

    useEffect((): (() => void) | void => {
        if (!successMessage) return;
        const timer = setTimeout((): void => { setSuccessMessage(''); }, 4000);
        return (): void => { clearTimeout(timer); };
    }, [successMessage]);

    // Re-register the browser push subscription with the backend on mount.
    // The backend uses an in-memory store so subscriptions are lost on restart.
    useEffect((): void => {
        if (!authUser?.notifyPush || !env.VAPID_PUBLIC_KEY) return;
        void getCurrentSubscription().then((sub): void => {
            if (!sub) return;
            const p256dh = sub.getKey('p256dh');
            const auth = sub.getKey('auth');
            if (!p256dh || !auth) return;
            mutateSubscribe({
                data: {
                    endpoint: sub.endpoint,
                    keys: {p256dh: encodeKey(p256dh), auth: encodeKey(auth)}
                } as unknown as SubscribePushDto
            });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally runs once on mount

    const handleSave = (e: React.FormEvent): void => {
        e.preventDefault();
        if (!authUser) return;

        setApiError('');
        setPushWarning('');

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

                    if (updated.notifyPush) {
                        void subscribeBrowser(env.VAPID_PUBLIC_KEY).then((sub): void => {
                            if (!sub) {
                                setPushWarning(
                                    'Push notifications could not be enabled. ' +
                                    'Check your browser permissions and try again.'
                                );
                                return;
                            }
                            const p256dh = sub.getKey('p256dh');
                            const auth = sub.getKey('auth');
                            if (!p256dh || !auth) return;
                            mutateSubscribe({
                                data: {
                                    endpoint: sub.endpoint,
                                    keys: {p256dh: encodeKey(p256dh), auth: encodeKey(auth)}
                                } as unknown as SubscribePushDto
                            });
                        });
                    } else {
                        void unsubscribeBrowser().then((endpoint): void => {
                            if (endpoint) {
                                mutateUnsubscribe(
                                    {data: {endpoint} as unknown as UnsubscribePushDto}
                                );
                            }
                        });
                    }

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

                {pushWarning !== '' && (
                    <p className={styles.apiError} role="alert">
                        {pushWarning}
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
