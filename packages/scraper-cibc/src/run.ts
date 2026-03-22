/**
 * Local dev runner — executes the full login → scrape → cleanup flow.
 *
 * Credentials are read from env vars using BANK_{KEY} pattern (e.g. BANK_CARDNUMBER).
 * If not set, you will be prompted. MFA codes are read from stdin.
 *
 * Usage:
 *   BANK_CARDNUMBER=mycard BANK_PASSWORD=mypass npm run scraper
 *   npm run scraper   (will prompt for missing values)
 */
import * as readline from 'node:readline/promises';
import {stdin, stdout, env, loadEnvFile} from 'node:process';
import plugin from './index.js';

// Load .env if present (silently skip if file doesn't exist)
try { loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* no .env */ }

const rl = readline.createInterface({input: stdin, output: stdout});

const prompt = async (question: string): Promise<string> => {
    const answer = await rl.question(question);
    return answer.trim();
};

const resolveMfa = async (mfaPrompt: string): Promise<string> => {
    return prompt(`[MFA] ${mfaPrompt}: `);
};

const main = async (): Promise<void> => {
    const inputs: Record<string, string> = {};
    for (const field of plugin.inputSchema) {
        const envKey = `BANK_${field.key.toUpperCase()}`;
        const envVal = env[envKey];
        if (envVal !== undefined) {
            inputs[field.key] = envVal;
        } else {
            const label = field.required ? field.label : `${field.label} (optional, press Enter to skip)`;
            const value = await prompt(`${label}: `);
            if (value || field.required) {
                inputs[field.key] = value;
            }
        }
    }

    const endDate   = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log(`\nScraping transactions from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}...\n`);

    try {
        console.log('Logging in...');
        await plugin.login(inputs, resolveMfa);

        console.log('Scraping transactions...');
        const transactions = await plugin.scrapeTransactions(inputs, {
            startDate,
            endDate,
            includePending: true
        });

        console.log(`\nFound ${transactions.length} transaction(s):\n`);
        for (const t of transactions) {
            const sign   = t.amount >= 0 ? '+' : '';
            const status = t.pending ? ' [pending]' : '';
            console.log(`  ${t.date}  ${sign}${t.amount.toFixed(2).padStart(9)}  ${t.description}${status}`);
        }
    } finally {
        await plugin.cleanup?.();
        rl.close();
    }
};

main().catch(err => {
    console.error(err);
    rl.close();
    process.exit(1);
});
