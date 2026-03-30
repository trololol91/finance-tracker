/**
 * useSyncJob — wraps run-now trigger and MFA response hooks.
 */
import {
    useState, useCallback
} from 'react';
import {
    useSyncJobControllerRunNow,
    useSyncJobControllerMfaResponse,
    useSyncJobControllerCancelMfa
} from '@/api/sync-schedules/sync-schedules.js';

export interface UseSyncJobReturn {
    sessionId: string | null;
    isTriggeringId: string | null;
    trigger: (scheduleId: string, startDate?: string) => void;
    submitMfa: (sessionId: string, mfaCode: string) => void;
    cancelSync: (sessionId: string) => void;
    clearSession: () => void;
    isSubmittingMfa: boolean;
    isCancellingMfa: boolean;
}

export const useSyncJob = (): UseSyncJobReturn => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isTriggeringId, setIsTriggeringId] = useState<string | null>(null);

    const runNowMutation = useSyncJobControllerRunNow();
    const mfaMutation = useSyncJobControllerMfaResponse();
    const cancelMfaMutation = useSyncJobControllerCancelMfa();

    const trigger = useCallback(
        (scheduleId: string, startDate?: string): void => {
            setIsTriggeringId(scheduleId);
            runNowMutation.mutate(
                {id: scheduleId, data: {startDate}},
                {
                    onSuccess: (result) => {
                        const data = result as unknown as {sessionId?: string} | undefined;
                        setSessionId(data?.sessionId ?? null);
                        setIsTriggeringId(null);
                    },
                    onError: (err: unknown) => {
                        console.error('[useSyncJob] trigger', err);
                        setIsTriggeringId(null);
                    }
                }
            );
        },
        [runNowMutation]
    );

    const submitMfa = useCallback(
        (id: string, mfaCode: string): void => {
            mfaMutation.mutate(
                {id, data: {code: mfaCode}},
                {
                    onError: (err: unknown) => { console.error('[useSyncJob] MFA', err); }
                }
            );
        },
        [mfaMutation]
    );

    const cancelSync = useCallback(
        (id: string): void => {
            cancelMfaMutation.mutate(
                {id},
                {onError: (err: unknown) => { console.error('[useSyncJob] cancelMfa', err); }}
            );
        },
        [cancelMfaMutation]
    );

    const clearSession = useCallback((): void => {
        setSessionId(null);
    }, []);

    return {
        sessionId,
        isTriggeringId,
        trigger,
        submitMfa,
        cancelSync,
        clearSession,
        isSubmittingMfa: mfaMutation.isPending,
        isCancellingMfa: cancelMfaMutation.isPending
    };
};
