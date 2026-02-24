// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default [
    {
        ignores: ['dist', 'coverage', 'eslint.config.js', 'vitest.config.ts', 'src/api/**']
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...globals.browser
            },
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        plugins: {
            '@stylistic': stylistic,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true }
            ],
            // Consistent formatting with backend
            '@stylistic/indent': ['error', 4],
            '@stylistic/quotes': ['error', 'single', {
                avoidEscape: true,
                allowTemplateLiterals: false
            }],
            '@stylistic/key-spacing': [
                'error',
                { afterColon: true }
            ],
            '@stylistic/max-len': [
                'error',
                {
                    code: 100,
                    tabWidth: 4,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true
                }
            ],
            '@stylistic/object-curly-spacing': ['error', 'never'],
            '@stylistic/object-curly-newline': [
                'error',
                {
                    ImportDeclaration: {
                        multiline: true,
                        minProperties: 2,
                        consistent: true
                    },
                    ExportDeclaration: {
                        multiline: true,
                        minProperties: 3,
                        consistent: true
                    }
                }
            ],
            '@stylistic/comma-dangle': [
                'error',
                'never'
            ],
            'prefer-arrow-callback': 'error',
            'func-style': ['error', 'expression'],
            'max-params': ['error', 5],
            'max-lines-per-function': ['warn', 100],
            'no-empty-function': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            '@typescript-eslint/no-empty-function': 'error',
            '@typescript-eslint/explicit-function-return-type': 'error',
            // Security & Best Practices
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            // Code Quality
            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports'
            }],
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/no-unnecessary-condition': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': 'error',
            '@typescript-eslint/prefer-optional-chain': 'error',
            '@typescript-eslint/no-confusing-void-expression': 'error',
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                    overrides: { constructors: 'no-public' }
                }
            ],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/member-delimiter-style': [
                'error',
                {
                    multiline: {
                        delimiter: 'semi',
                        requireLast: true
                    },
                    singleline: {
                        delimiter: 'comma',
                        requireLast: false
                    }
                }
            ],
            // Import Rules - Enforce path aliases
            'no-restricted-imports': ['error', {
                patterns: [{
                    group: ['../*', './*'],
                    message: 'Use path aliases (@/*) instead of relative imports'
                }]
            }]
        }
    },
    {
        files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
        rules: {
            'max-lines-per-function': 'off',
            'max-params': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off'
        }
    },
    {
        files: [
            'src/types/**',
            'src/features/**/types/**',
            'src/services/**/types/**',
            'src/**/test/**',
        ],
        rules: {
            '@typescript-eslint/explicit-member-accessibility': 'off'
        }
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        rules: {
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off'
        }
    }
];
