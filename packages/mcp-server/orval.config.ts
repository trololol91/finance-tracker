import {defineConfig} from 'orval';

export default defineConfig({
    financeTracker: {
        input: {
            target: '../frontend/openapi.json',
        },
        output: {
            mode: 'tags-split',
            target: 'src/api',
            schemas: 'src/api/model',
            client: 'fetch',
            override: {
                mutator: {
                    path: 'src/services/fetcher.ts',
                    name: 'mcpFetcher',
                },
            },
            clean: true,
        },
    },
});
