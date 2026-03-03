import {
    describe,
    it,
    expect,
    beforeEach
} from 'vitest';
import {SyncSessionStore} from '#scraper/sync-session.store.js';
import type {MessageEvent} from '@nestjs/common';

describe('SyncSessionStore', () => {
    let store: SyncSessionStore;

    beforeEach(() => {
        store = new SyncSessionStore();
    });

    // -------------------------------------------------------------------------
    // createSession / hasSession
    // -------------------------------------------------------------------------

    describe('createSession / hasSession', () => {
        it('should return false for a non-existent session', () => {
            expect(store.hasSession('no-such-id')).toBe(false);
        });

        it('should return true after createSession', () => {
            store.createSession('sess-1');

            expect(store.hasSession('sess-1')).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // getObservable
    // -------------------------------------------------------------------------

    describe('getObservable', () => {
        it('should return EMPTY for a non-existent session', () => {
            const obs = store.getObservable('no-such-id');
            let completed = false;
            obs.subscribe({complete: () => { completed = true; }});

            expect(completed).toBe(true);
        });

        it('should return an observable that emits events', () => {
            store.createSession('s1');
            const received: MessageEvent[] = [];
            store.getObservable('s1').subscribe(e => received.push(e));

            const event = {data: 'hello'} as MessageEvent;
            store.emit('s1', event);

            expect(received).toHaveLength(1);
            expect(received[0]).toBe(event);
        });

        it('should complete the observable when complete() is called', () => {
            store.createSession('s2');
            let completed = false;
            store.getObservable('s2').subscribe({complete: () => { completed = true; }});

            store.complete('s2');

            expect(completed).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // emit
    // -------------------------------------------------------------------------

    describe('emit', () => {
        it('should silently ignore emit to non-existent session', () => {
            expect(() => { store.emit('ghost', {data: 'x'} as MessageEvent); }).not.toThrow();
        });

        it('should emit multiple events in order', () => {
            store.createSession('s3');
            const received: string[] = [];
            store.getObservable('s3').subscribe(e => received.push(e.data as string));

            store.emit('s3', {data: 'first'} as MessageEvent);
            store.emit('s3', {data: 'second'} as MessageEvent);

            expect(received).toEqual(['first', 'second']);
        });
    });

    // -------------------------------------------------------------------------
    // complete
    // -------------------------------------------------------------------------

    describe('complete', () => {
        it('should remove the session after completion', () => {
            store.createSession('s4');
            store.complete('s4');

            expect(store.hasSession('s4')).toBe(false);
        });

        it('should silently ignore complete on non-existent session', () => {
            expect(() => { store.complete('ghost'); }).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // MFA resolver
    // -------------------------------------------------------------------------

    describe('MFA resolver', () => {
        it('should return false when no resolver is registered', () => {
            store.createSession('s5');

            expect(store.resolveMfa('s5', '123456')).toBe(false);
        });

        it('should call the resolver and clear it', () => {
            store.createSession('s6');
            let resolvedCode = '';
            store.setMfaResolver('s6', code => { resolvedCode = code; });

            const result = store.resolveMfa('s6', '789012');

            expect(result).toBe(true);
            expect(resolvedCode).toBe('789012');
            // Resolver is cleared after first call
            expect(store.resolveMfa('s6', 'second')).toBe(false);
        });

        it('should return false for resolveMfa on non-existent session', () => {
            expect(store.resolveMfa('no-session', '123')).toBe(false);
        });

        it('should silently ignore setMfaResolver on non-existent session', () => {
            expect(() => { store.setMfaResolver('ghost', () => { /* noop */ }); }).not.toThrow();
        });

        it('should correctly report hasPendingMfa', () => {
            store.createSession('s7');

            expect(store.hasPendingMfa('s7')).toBe(false);

            store.setMfaResolver('s7', () => { /* noop */ });

            expect(store.hasPendingMfa('s7')).toBe(true);

            store.resolveMfa('s7', 'code');

            expect(store.hasPendingMfa('s7')).toBe(false);
        });
    });
});
