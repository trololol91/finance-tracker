import {Injectable} from '@nestjs/common';

/** Shape of a Web Push subscription as returned by PushSubscription.toJSON(). */
export interface StoredPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

/**
 * In-memory store of Web Push subscriptions per user.
 * Subscriptions are lost on process restart — acceptable for Phase 8.
 * Each endpoint is unique; a second registration with the same endpoint
 * replaces the existing entry rather than creating a duplicate.
 */
@Injectable()
export class PushSubscriptionStore {
    private readonly subscriptions = new Map<string, StoredPushSubscription[]>();

    /** Add or update a subscription for a user. */
    public add(userId: string, sub: StoredPushSubscription): void {
        const existing = this.subscriptions.get(userId) ?? [];
        const filtered = existing.filter((s) => s.endpoint !== sub.endpoint);
        this.subscriptions.set(userId, [...filtered, sub]);
    }

    /** Remove a subscription by endpoint for a user. */
    public remove(userId: string, endpoint: string): void {
        const existing = this.subscriptions.get(userId) ?? [];
        this.subscriptions.set(
            userId,
            existing.filter((s) => s.endpoint !== endpoint)
        );
    }

    /** Return all subscriptions for a user. */
    public getAll(userId: string): StoredPushSubscription[] {
        return [...(this.subscriptions.get(userId) ?? [])];
    }
}
