import {defineConfig} from 'orval';

/**
 * Orval configuration
 *
 * Generates fully type-safe React Query hooks and TypeScript models from the
 * NestJS/Swagger OpenAPI spec.
 *
 * Usage:
 *   npm run generate:api          ← requires backend running on localhost:3001
 *   npm run generate:api:file     ← generates from saved openapi.json snapshot
 *
 * Output layout (tags-split mode, one file per backend resource):
 *   src/api/
 *     auth.ts           → useLoginMutation, useRegisterMutation, …
 *     transactions.ts   → useGetTransactions, useCreateTransaction, …
 *     users.ts          → useGetUsers, useGetUsersId, …
 *     …
 *     model/            → all DTO / entity TypeScript types
 */
export default defineConfig({
    financeTracker: {
        input: {
            // Live spec — requires backend dev server to be running.
            // Use `generate:api:file` to generate from the saved snapshot instead.
            target: './openapi.json'
            // Swap the line above for the one below when the backend is running:
            // target: 'http://localhost:3001/api-json',
        },
        output: {
            target: './src/api',
            schemas: './src/api/model',
            client: 'react-query',
            // Use Axios as the underlying HTTP client (instead of the default fetch)
            // so our interceptors handle auth and error responses automatically.
            httpClient: 'axios',
            // One file per OpenAPI tag  (auth.ts, transactions.ts, …)
            mode: 'tags-split',
            override: {
                mutator: {
                    // All generated calls are routed through our Axios instance
                    // so auth, error handling, and interceptors apply automatically.
                    path: './src/services/api/mutator.ts',
                    name: 'customInstance'
                },
                query: {
                    // Keep React Query v5 compatible option names
                    useSuspenseQuery: false,
                    usePrefetch: true
                }
            }
        }
    }
});
