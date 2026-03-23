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
const encodeKey = (buf: ArrayBuffer): string => {
    let binary = '';
    for (const byte of new Uint8Array(buf)) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
};

export const NotificationsForm = (): React.JSX.Element => {
    const {user: authUser, updateUser} = useAuth();
    const {mutate: updateProfile, isPending: isSaving} = useUsersControllerUpdate();
    const {mutate: mutateSubscribe} = usePushControllerSubscribe();
    const {mutate: mutateUnsubscribe} = usePushControllerUnsubscribe();

    // Per-device push subscription state
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isCheckingPush, setIsCheckingPush] = useState(true);
    const [isPushLoading, setIsPushLoading] = useState(false);
    const [pushWarning, setPushWarning] = useState<string>('');

    // Email preference (saved via form)
    const [notifyEmail, setNotifyEmail] = useState<boolean>(authUser?.notifyEmail ?? false);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');

    useEffect((): (() => void) | void => {
        if (!successMessage) return;
        const timer = setTimeout((): void => { setSuccessMessage(''); }, 4000);
        return (): void => { clearTimeout(timer); };
    }, [successMessage]);

    // Check current browser subscription status on mount
    useEffect((): void => {
        void getCurrentSubscription().then((sub): void => {
            setIsSubscribed(sub !== null);
            setIsCheckingPush(false);
        });
    }, []);

    const handleEnablePush = (): void => {
        if (!env.VAPID_PUBLIC_KEY) return;
        setPushWarning('');
        setIsPushLoading(true);
        void subscribeBrowser(env.VAPID_PUBLIC_KEY).then((sub): void => {
            setIsPushLoading(false);
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
            setIsSubscribed(true);
        });
    };

    const handleDisablePush = (): void => {
        setIsPushLoading(true);
        void unsubscribeBrowser().then((endpoint): void => {
            setIsPushLoading(false);
            if (endpoint) {
                mutateUnsubscribe({data: {endpoint} as unknown as UnsubscribePushDto});
            }
            setIsSubscribed(false);
        });
    };

    const handleSave = (e: React.FormEvent): void => {
        e.preventDefault();
        if (!authUser) return;
        setApiError('');

        const data: UpdateUserDto = {notifyEmail};
        updateProfile(
            {id: authUser.id, data},
            {
                onSuccess: (updated): void => {
                    updateUser({...authUser, notifyEmail: updated.notifyEmail});
                    setSuccessMessage('Notification preferences saved.');
                },
                onError: (): void => {
                    setApiError('Failed to save preferences. Please try again.');
                }
            }
        );
    };

    const pushDescription = (): string => {
        if (!env.VAPID_PUBLIC_KEY) return 'Push notifications are not available.';
        if (isCheckingPush) return 'Checking this device…';
        return isSubscribed
            ? 'Push notifications are enabled on this device.'
            : 'Push notifications are not enabled on this device.';
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
                    <div className={styles.toggleLabel}>
                        <span className={styles.toggleText}>
                            <span className={styles.toggleTitle}>Push notifications</span>
                            <span className={styles.toggleDescription}>
                                {pushDescription()}
                            </span>
                        </span>
                        {env.VAPID_PUBLIC_KEY !== '' && (
                            <Button
                                type="button"
                                variant={isSubscribed ? 'danger' : 'primary'}
                                size="small"
                                isLoading={isPushLoading || isCheckingPush}
                                onClick={isSubscribed ? handleDisablePush : handleEnablePush}
                            >
                                {isSubscribed ? 'Disable' : 'Enable'}
                            </Button>
                        )}
                    </div>
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
