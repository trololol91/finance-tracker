// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import jest from 'eslint-plugin-jest';

export default tseslint.config(
    {
        ignores: ['eslint.config.mjs'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
        globals: {
            ...globals.node,
            ...globals.jest,
        },
        sourceType: 'commonjs',
        parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            // '@typescript-eslint': tseslint.plugin,
            '@stylistic': stylistic,
            '@jest': jest,
        },
        rules: {
            "indent": ["error", 4],
            'no-empty-function': 'off',
            "@typescript-eslint/no-explicit-any": "error",
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-empty-function': 'error',
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/member-delimiter-style': [
                'error',
                {
                    multiline: {
                        delimiter: 'semi',
                        requireLast: true,
                    },
                    singleline: {
                        delimiter: 'comma',
                        requireLast: false,
                    }
                },
            ],
            '@typescript-eslint/unbound-method': 'off',
            '@jest/unbound-method': 'error'
        },
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        extends: [tseslint.configs.disableTypeChecked],
    }
);