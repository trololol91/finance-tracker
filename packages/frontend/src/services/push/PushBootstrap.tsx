import React, {useEffect} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {usePushControllerSubscribe} from '@/api/push/push.js';
import {
    getCurrentSubscription,
    encodeKey
} from '@services/push/pushSubscription.js';
import type {SubscribePushDto} from '@/api/model/index.js';

interface PushBootstrapProps {
    children: React.ReactNode;
}

/**
 * On every app load, re-registers any existing browser push subscription
 * with the backend.  The backend uses an in-memory store, so subscriptions
 * are lost on restart — this keeps delivery working without any user action.
 */
export const PushBootstrap = ({children}: PushBootstrapProps): React.JSX.Element => {
    const {user} = useAuth();
    const {mutate: mutateSubscribe} = usePushControllerSubscribe();

    useEffect((): void => {
        if (!user?.id) return;
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
    }, [user?.id, mutateSubscribe]);

    return <>{children}</>;
};
