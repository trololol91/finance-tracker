import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/mockData',
                'src/main.tsx',
                'src/**/__TEST__/**',
                '**/*.test.{ts,tsx}',
                '**/*.spec.{ts,tsx}',
                'src/types/**',
                'src/**/types/**',
                '**/*.types.ts',
                '**/index.ts',
                'src/routes/**',
                'src/pages/**',
                'src/App.tsx',
                'src/services/api/**',
                'src/api/**',
                'src/components/layout/**',
                'src/utils/constants.ts',
                'src/config/env.ts'
            ],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90
            }
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@features': path.resolve(__dirname, './src/features'),
            '@pages': path.resolve(__dirname, './src/pages'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@services': path.resolve(__dirname, './src/services'),
            '@utils': path.resolve(__dirname, './src/utils'),
            '@types': path.resolve(__dirname, './src/types'),
            '@styles': path.resolve(__dirname, './src/styles'),
            '@store': path.resolve(__dirname, './src/store'),
            '@routes': path.resolve(__dirname, './src/routes'),
            '@config': path.resolve(__dirname, './src/config'),
        },
    },
});
