#!/usr/bin/env node
/**
 * Custom Playwright browser server.
 *
 * Launches Chromium with headless: false (requires Xvfb via DISPLAY env var)
 * and exposes it over WebSocket so scraper plugins can connect with
 * chromium.connect(PLAYWRIGHT_SERVER_URL) without needing a local browser.
 */
import {chromium} from 'playwright';

const port = parseInt(process.env.PLAYWRIGHT_SERVER_PORT ?? '3003', 10);
const host = process.env.PLAYWRIGHT_SERVER_HOST ?? '0.0.0.0';

const server = await chromium.launchServer({
    headless: false,
    host,
    port,
    wsPath: 'ws',   // fixed path → ws://playwright-server:3003/ws
    args: [
        '--no-sandbox',
        '--disable-dev-shm-usage'
    ]
});

console.log(`Listening on ${server.wsEndpoint()}`);

process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
});
