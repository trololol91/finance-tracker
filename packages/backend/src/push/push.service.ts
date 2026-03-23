import {
    Injectable,
    Logger
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import webpush from 'web-push';
import * as nodemailer from 'nodemailer';
import type {Transporter} from 'nodemailer';
import type {SentMessageInfo} from 'nodemailer/lib/smtp-transport/index.js';
import {PrismaService} from '#database/prisma.service.js';
import {PushSubscriptionStore} from '#push/push-subscription.store.js';
import type {SubscribePushDto} from '#push/dto/subscribe-push.dto.js';

/** Escape HTML special characters to prevent injection in email bodies. */
const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * Sends Web Push VAPID notifications and/or email alerts when a scraper
 * requires MFA input.  Push delivery is attempted for all registered
 * subscriptions; email is gated by the user's `notifyEmail` preference.
 *
 * Web Push subscriptions are kept in an in-memory store and are lost on
 * process restart — callers should re-register subscriptions on startup
 * (handled by PushBootstrap on the frontend).
 */
@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);
    private readonly vapidConfigured: boolean;
    private readonly smtpTransporter: Transporter<SentMessageInfo> | null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly store: PushSubscriptionStore,
        private readonly config: ConfigService
    ) {
        this.vapidConfigured = this.initVapid();
        this.smtpTransporter = this.initSmtp();
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /** Register or refresh a Web Push subscription for the given user. */
    public subscribe(userId: string, dto: SubscribePushDto): void {
        this.store.add(userId, {
            endpoint: dto.endpoint,
            keys: {p256dh: dto.keys.p256dh, auth: dto.keys.auth}
        });
    }

    /** Remove a Web Push subscription by its endpoint URL. */
    public unsubscribe(userId: string, endpoint: string): void {
        this.store.remove(userId, endpoint);
    }

    /**
     * Deliver an MFA-required notification to the given user via Web Push
     * and/or email, depending on their notification preferences.
     *
     * Errors from individual push subscribers are caught and logged so that
     * one stale subscription does not prevent the rest from receiving messages.
     */
    public async sendNotification(
        userId: string,
        title: string,
        body: string,
        url: string
    ): Promise<void> {
        const user = await this.prisma.user.findUnique({where: {id: userId}});
        if (!user) {
            this.logger.warn(`sendNotification: user ${userId} not found — skipping`);
            return;
        }

        const pushPromise = this.sendWebPush(userId, title, body, url);

        const emailPromise = user.notifyEmail
            ? this.sendEmail(user.email, title, body, url)
            : Promise.resolve();

        await Promise.allSettled([pushPromise, emailPromise]);
    }

    // ---------------------------------------------------------------------------
    // Private — initialisation
    // ---------------------------------------------------------------------------

    private initVapid(): boolean {
        const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
        const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
        const subject = this.config.get<string>('VAPID_SUBJECT');

        if (!publicKey || !privateKey || !subject) {
            this.logger.warn(
                'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not set — ' +
                'Web Push notifications disabled'
            );
            return false;
        }

        webpush.setVapidDetails(subject, publicKey, privateKey);
        return true;
    }

    private initSmtp(): Transporter<SentMessageInfo> | null {
        const host = this.config.get<string>('SMTP_HOST');
        const user = this.config.get<string>('SMTP_USER');
        const pass = this.config.get<string>('SMTP_PASS');

        if (!host || !user || !pass) {
            this.logger.warn(
                'SMTP_HOST / SMTP_USER / SMTP_PASS not set — ' +
                'email notifications disabled'
            );
            return null;
        }

        const rawPort = this.config.get<string>('SMTP_PORT') ?? '587';
        const port = parseInt(rawPort, 10);
        if (isNaN(port)) {
            throw new Error(`SMTP_PORT "${rawPort}" is not a valid port number`);
        }

        return nodemailer.createTransport({
            host,
            port,
            secure: false,
            requireTLS: true,
            auth: {user, pass}
        });
    }

    // ---------------------------------------------------------------------------
    // Private — delivery
    // ---------------------------------------------------------------------------

    private async sendWebPush(
        userId: string,
        title: string,
        body: string,
        url: string
    ): Promise<void> {
        if (!this.vapidConfigured) return;

        const subscriptions = this.store.getAll(userId);
        if (subscriptions.length === 0) return;

        const payload = JSON.stringify({title, body, url});

        await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        sub as unknown as webpush.PushSubscription,
                        payload
                    );
                } catch (err: unknown) {
                    const status =
                        typeof err === 'object' &&
                        err !== null &&
                        'statusCode' in err
                            ? (err as {statusCode: number}).statusCode
                            : 0;

                    // 404 / 410 — subscription expired or unregistered; purge it
                    if (status === 404 || status === 410) {
                        this.store.remove(userId, sub.endpoint);
                        this.logger.warn(
                            `Removed stale push subscription for user ${userId} ` +
                            `(HTTP ${String(status)})`
                        );
                    } else {
                        this.logger.error(
                            `Failed to send push notification to user ${userId}`,
                            err instanceof Error ? err.stack : String(err)
                        );
                    }
                }
            })
        );
    }

    private async sendEmail(
        to: string,
        title: string,
        body: string,
        url: string
    ): Promise<void> {
        if (!this.smtpTransporter) return;

        const from = this.config.get<string>('SMTP_USER');

        try {
            await this.smtpTransporter.sendMail({
                from,
                to,
                subject: title,
                text: `${body}\n\nAction required: ${url}`,
                html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">Complete MFA</a></p>`
            });
        } catch (err: unknown) {
            this.logger.error(
                `Failed to send email notification to ${to}`,
                err instanceof Error ? err.stack : String(err)
            );
        }
    }
}
