import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.spec.ts'],
        exclude: ['src/api/**'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/api/**', 'src/__TEST__/**', 'src/tools/__TEST__/**', 'src/index.ts', 'src/http-transport.ts', 'src/tools/types.ts'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80
            }
        }
    }
});
