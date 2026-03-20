/**
 * useSyncJob — wraps run-now trigger and MFA response hooks.
 */
import {
    useState, useCallback
} from 'react';
import {
    useSyncJobControllerRunNow,
    useSyncJobControllerMfaResponse
} from '@/api/sync-schedules/sync-schedules.js';

export interface UseSyncJobReturn {
    sessionId: string | null;
    isTriggeringId: string | null;
    trigger: (scheduleId: string, startDate?: string) => void;
    submitMfa: (sessionId: string, mfaCode: string) => void;
    clearSession: () => void;
    isSubmittingMfa: boolean;
}

export const useSyncJob = (): UseSyncJobReturn => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isTriggeringId, setIsTriggeringId] = useState<string | null>(null);

    const runNowMutation = useSyncJobControllerRunNow();
    const mfaMutation = useSyncJobControllerMfaResponse();

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
        (sessionId: string, mfaCode: string): void => {
            mfaMutation.mutate(
                {id: sessionId, data: {code: mfaCode}},
                {
                    onError: (err: unknown) => { console.error('[useSyncJob] MFA', err); }
                }
            );
        },
        [mfaMutation]
    );

    const clearSession = useCallback((): void => {
        setSessionId(null);
    }, []);

    return {
        sessionId,
        isTriggeringId,
        trigger,
        submitMfa,
        clearSession,
        isSubmittingMfa: mfaMutation.isPending
    };
};
