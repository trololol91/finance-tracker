/**
 * Fetches the OpenAPI JSON spec from the running NestJS backend and writes it
 * to `openapi.json` in the frontend root so Orval can generate the API client
 * without the backend needing to stay running during code generation.
 *
 * Requires the backend dev server to be running:
 *   cd packages/backend && npm run start:dev
 *
 * Usage:
 *   npx tsx scripts/fetch-openapi.ts
 *   npm run openapi:fetch
 */

import {writeFileSync} from 'fs';
import {
    resolve, dirname
} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.API_URL ?? 'http://localhost:3001';
const SPEC_URL = `${BACKEND_URL}/api-json`;
const OUTPUT_PATH = resolve(__dirname, '../openapi.json');

console.log(`Fetching OpenAPI spec from ${SPEC_URL} …`);

const response = await fetch(SPEC_URL);

if (!response.ok) {
    console.error(`✗ Failed to fetch spec: ${response.status} ${response.statusText}`);
    console.error(`  Make sure the backend is running at ${BACKEND_URL}`);
    process.exit(1);
}

const spec: unknown = await response.json();
writeFileSync(OUTPUT_PATH, JSON.stringify(spec, null, 2), 'utf-8');

console.log(`✓ OpenAPI spec written to: ${OUTPUT_PATH}`);
