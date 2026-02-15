import {defineConfig} from 'vitest/config';
import {resolve} from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['reflect-metadata'],
        include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.spec.ts',
                '**/*.e2e-spec.ts',
                'src/integrations/google-drive/**'
            ]
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@common': resolve(__dirname, './src/common'),
            '@config': resolve(__dirname, './src/config'),
            '@database': resolve(__dirname, './src/database'),
            '@auth': resolve(__dirname, './src/auth'),
            '@users': resolve(__dirname, './src/users'),
            '@transactions': resolve(__dirname, './src/transactions'),
            '@categories': resolve(__dirname, './src/categories'),
            '@accounts': resolve(__dirname, './src/accounts'),
            '@budgets': resolve(__dirname, './src/budgets'),
            '@reports': resolve(__dirname, './src/reports'),
            '@scraper': resolve(__dirname, './src/scraper'),
            '@ai': resolve(__dirname, './src/ai'),
            '@integrations': resolve(__dirname, './src/integrations')
        }
    }
});
