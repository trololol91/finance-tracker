import {Injectable} from '@nestjs/common';
import {
    Subject,
    Observable,
    EMPTY
} from 'rxjs';
import type {MessageEvent} from '@nestjs/common';

interface SessionEntry {
    subject: Subject<MessageEvent>;
    mfaResolver: ((code: string) => void) | null;
}

/**
 * In-memory store for active sync-job SSE sessions.
 * One entry per active SyncJob; keyed by job.id (== sessionId).
 * Sessions are purely in-memory — a server restart during a pending MFA
 * challenge will fail that sync run.
 */
@Injectable()
export class SyncSessionStore {
    private readonly sessions = new Map<string, SessionEntry>();

    /** Create a new session for the given sessionId. */
    public createSession(sessionId: string): void {
        this.sessions.set(sessionId, {
            subject: new Subject<MessageEvent>(),
            mfaResolver: null
        });
    }

    /** Emit a MessageEvent to all SSE subscribers for this session. */
    public emit(sessionId: string, event: MessageEvent): void {
        this.sessions.get(sessionId)?.subject.next(event);
    }

    /** Complete the observable and remove the session entry. */
    public complete(sessionId: string): void {
        const entry = this.sessions.get(sessionId);
        if (entry) {
            entry.subject.complete();
            this.sessions.delete(sessionId);
        }
    }

    /** Get the Observable<MessageEvent> for SSE streaming. Returns EMPTY if not found. */
    public getObservable(sessionId: string): Observable<MessageEvent> {
        return this.sessions.get(sessionId)?.subject.asObservable() ?? EMPTY;
    }

    /**
     * Register a one-shot resolver for an MFA code.
     * Called by ScraperService when the worker emits `mfa_required`.
     * The resolver posts the code back to the worker thread.
     */
    public setMfaResolver(sessionId: string, resolver: (code: string) => void): void {
        const entry = this.sessions.get(sessionId);
        if (entry) {
            entry.mfaResolver = resolver;
        }
    }

    /**
     * Submit an MFA code to the waiting worker.
     * Returns true if a resolver was found and called, false if no pending MFA.
     */
    public resolveMfa(sessionId: string, code: string): boolean {
        const entry = this.sessions.get(sessionId);
        if (entry?.mfaResolver) {
            entry.mfaResolver(code);
            entry.mfaResolver = null;
            return true;
        }
        return false;
    }

    /** Returns true if a session exists for the given sessionId. */
    public hasSession(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    /** Returns true if the session has a pending MFA resolver. */
    public hasPendingMfa(sessionId: string): boolean {
        return this.sessions.get(sessionId)?.mfaResolver !== null &&
               this.sessions.get(sessionId)?.mfaResolver !== undefined;
    }
}
