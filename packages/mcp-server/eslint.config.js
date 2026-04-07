// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default [
    {
        ignores: ['dist', 'coverage', 'eslint.config.js', 'src/api', 'orval.config.ts']
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            globals: {
                ...globals.node
            },
            sourceType: 'module',
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.ts', 'scripts/*.ts', 'src/__TEST__/*.ts', 'src/tools/__TEST__/*.ts']
                },
                tsconfigRootDir: import.meta.dirname
            }
        },
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            '@stylistic/indent': ['error', 4],
            '@stylistic/quotes': ['error', 'single', {
                avoidEscape: true,
                allowTemplateLiterals: false
            }],
            '@stylistic/key-spacing': [
                'error',
                {afterColon: true}
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
            '@stylistic/comma-dangle': ['error', 'never'],
            '@stylistic/semi': ['error', 'always'],
            'prefer-arrow-callback': 'error',
            'func-style': ['error', 'expression'],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports'
            }]
        }
    },
    {
        files: ['**/*.spec.ts', '**/*.test.ts'],
        rules: {
            'max-lines-per-function': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off'
        }
    }
];
