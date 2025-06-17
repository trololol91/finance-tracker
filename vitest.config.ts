import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.{test,spec}.{ts,mts}'],
        coverage: {
            reporter: ['text', 'html'],
            include: ['src/api/**/*.{mts,ts}'],
            thresholds: {
                lines: 80,
                functions: 80, 
                branches: 80,
                statements: 80,
            },
            exclude: ['node_modules/'],
        },
    },
    resolve: {
        alias: {
            // Map base directory paths to match your tsconfig paths
            'middleware': resolve(__dirname, './src/middleware'),
            'utils': resolve(__dirname, './src/utils'),
            'api': resolve(__dirname, './src/api'),
        },
    },
});
