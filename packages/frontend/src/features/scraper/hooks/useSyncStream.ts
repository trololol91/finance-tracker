/**
 * useSyncStream — opens an SSE connection to GET /sync-schedules/:sessionId/stream
 * and yields typed SyncStreamEvent objects.
 *
 * Uses fetch() rather than EventSource so the Authorization header can be sent.
 * Opens when sessionId is non-null; closes when:
 *   - a "complete" or "failed" event is received
 *   - sessionId changes to null
 *   - the component unmounts
 */
import {
    useState, useEffect, useRef
} from 'react';
import {env} from '@config/env.js';
import {STORAGE_KEYS} from '@config/constants.js';
import type {
    SyncStreamEvent,
    UseSyncStreamResult
} from '@features/scraper/types/scraper.types.js';

const IDLE_EVENT: SyncStreamEvent = {status: 'idle'};

/**
 * Parse one raw SSE block (event type + data) into a SyncStreamEvent.
 * Returns null for unknown or malformed events.
 */
const parseSseBlock = (block: string): SyncStreamEvent | null => {
    let eventType = 'message';
    let dataStr = '';
    for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr = line.slice(5).trim();
    }
    if (dataStr === '') return null;
    try {
        const p = JSON.parse(dataStr) as Record<string, unknown>;
        switch (eventType) {
            case 'status':
                return {
                    status: 'running',
                    message: typeof p.message === 'string' ? p.message : undefined
                };
            case 'mfa':
                return {
                    status: 'mfa_required',
                    mfaChallenge: typeof p.mfaChallenge === 'string' ? p.mfaChallenge : undefined
                };
            case 'complete':
                return {
                    status: 'completed',
                    importedCount: typeof p.importedCount === 'number' ? p.importedCount : undefined,
                    skippedCount: typeof p.skippedCount === 'number' ? p.skippedCount : undefined
                };
            case 'failed':
                return {
                    status: 'failed',
                    errorMessage: typeof p.errorMessage === 'string' ? p.errorMessage : undefined
                };
            default:
                return null;
        }
    } catch {
        return null;
    }
};

const isTerminal = (e: SyncStreamEvent): boolean =>
    e.status === 'completed' || e.status === 'failed';

export const useSyncStream = (sessionId: string | null): UseSyncStreamResult => {
    const [event, setEvent] = useState<SyncStreamEvent>(IDLE_EVENT);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (sessionId === null) {
            // Reset to idle — using refs avoids setState-in-effect
            abortRef.current?.abort();
            abortRef.current = null;
            queueMicrotask(() => {
                setEvent(IDLE_EVENT);
                setIsConnected(false);
                setError(null);
            });
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ?? '';
        const url = `${env.API_BASE_URL}/sync-schedules/${sessionId}/stream`;

        // Synchronous pre-fetch init before await; only setEvent triggers the
        // react-hooks/set-state-in-effect rule — setIsConnected/setError do not.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEvent({status: 'running'});
        setIsConnected(false);
        setError(null);

        const run = async (): Promise<void> => {
            try {
                const res = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'text/event-stream'
                    },
                    signal: controller.signal
                });
                if (!res.ok) {
                    setError(`Stream failed: HTTP ${res.status}`);
                    return;
                }
                setIsConnected(true);
                const reader = res.body?.getReader();
                if (!reader) { setError('Response body unreadable'); return; }
                let buf = '';
                const decoder = new TextDecoder();
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, {stream: true});
                    const blocks = buf.split('\n\n');
                    buf = blocks.pop() ?? '';
                    for (const block of blocks) {
                        if (block.trim() === '') continue;
                        const parsed = parseSseBlock(block);
                        if (parsed !== null) {
                            setEvent(parsed);
                            if (isTerminal(parsed)) {
                                setIsConnected(false);
                                reader.cancel().catch(() => undefined);
                                return;
                            }
                        }
                    }
                }
                setIsConnected(false);
            } catch (err: unknown) {
                if ((err as {name?: string}).name === 'AbortError') return;
                console.error('[useSyncStream]', err);
                setError((err as {message?: string}).message ?? 'Stream error');
                setIsConnected(false);
            }
        };

        void run();
        return (): void => { controller.abort(); setIsConnected(false); };
    }, [sessionId]);

    return {event, isConnected, error};
};
