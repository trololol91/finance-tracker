import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import type {ConfigService} from '@nestjs/config';
import {AiCategorizationService} from '#ai-categorization/ai-categorization.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a ConfigService mock that returns the given env-like values.
 */
const makeConfig = (
    values: Record<string, string | undefined>
): ConfigService => ({
    get: vi.fn((key: string) => values[key])
} as unknown as ConfigService);

/**
 * Construct a service instance wired to OpenAI with the client pre-replaced
 * by a mock so no real HTTP calls are made.
 */
const makeOpenAiService = (
    mockCreate: ReturnType<typeof vi.fn>
): AiCategorizationService => {
    const config = makeConfig({
        AI_PROVIDER: 'openai',
        AI_MODEL: 'gpt-4o-mini',
        OPENAI_API_KEY: 'test-key'
    });
    const svc = new AiCategorizationService(config);
    // Replace the private client with our mock
    (svc as unknown as {openaiClient: unknown}).openaiClient = {
        chat: {completions: {create: mockCreate}}
    };
    return svc;
};

/**
 * Construct a service instance wired to Anthropic with the client pre-replaced.
 */
const makeAnthropicService = (
    mockCreate: ReturnType<typeof vi.fn>
): AiCategorizationService => {
    const config = makeConfig({
        AI_PROVIDER: 'anthropic',
        AI_MODEL: 'claude-3-haiku-20240307',
        ANTHROPIC_API_KEY: 'test-key'
    });
    const svc = new AiCategorizationService(config);
    (svc as unknown as {anthropicClient: unknown}).anthropicClient = {
        messages: {create: mockCreate}
    };
    return svc;
};

/** Build a minimal OpenAI chat completion response with the given text. */
const openAiResponse = (text: string) => ({
    choices: [{message: {content: text}}]
});

/** Build a minimal Anthropic messages response with the given text. */
const anthropicResponse = (text: string) => ({
    content: [{type: 'text', text}]
});

/** Build an Anthropic response whose first content block is not text. */
const anthropicNonTextResponse = () => ({
    content: [{type: 'tool_use', id: 'tu-1', name: 'fn', input: {}}]
});

const CATEGORIES = ['Food & Dining', 'Income', 'Housing', 'Other'];

// ---------------------------------------------------------------------------
// suggestCategory
// ---------------------------------------------------------------------------

describe('AiCategorizationService.suggestCategory', () => {
    describe('OpenAI provider', () => {
        let mockCreate: ReturnType<typeof vi.fn>;
        let svc: AiCategorizationService;

        beforeEach(() => {
            mockCreate = vi.fn();
            svc = makeOpenAiService(mockCreate);
        });

        it('returns the category name for a valid JSON response', async () => {
            mockCreate.mockResolvedValue(
                openAiResponse('{"category": "Food & Dining"}')
            );

            const result = await svc.suggestCategory(
                'Sobeys grocery', 'expense', CATEGORIES
            );

            expect(result).toBe('Food & Dining');
        });

        it('returns null for malformed JSON', async () => {
            mockCreate.mockResolvedValue(openAiResponse('not json at all'));

            const result = await svc.suggestCategory(
                'Mystery', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });

        it('parses JSON wrapped in markdown code fences', async () => {
            mockCreate.mockResolvedValue(
                openAiResponse('```json\n{"category": "Housing"}\n```')
            );

            const result = await svc.suggestCategory(
                'Rent payment', 'expense', CATEGORIES
            );

            expect(result).toBe('Housing');
        });

        it('parses JSON wrapped in plain code fences (no language tag)', async () => {
            mockCreate.mockResolvedValue(
                openAiResponse('```\n{"category": "Income"}\n```')
            );

            const result = await svc.suggestCategory(
                'Payroll', 'income', CATEGORIES
            );

            expect(result).toBe('Income');
        });

        it('returns null when JSON is valid but has no "category" key', async () => {
            mockCreate.mockResolvedValue(openAiResponse('{"name": "Food & Dining"}'));

            const result = await svc.suggestCategory(
                'Sobeys', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });

        it('returns null when "category" is not a string', async () => {
            mockCreate.mockResolvedValue(openAiResponse('{"category": 42}'));

            const result = await svc.suggestCategory(
                'Sobeys', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });

        it('returns null when choices array is empty (no content)', async () => {
            mockCreate.mockResolvedValue({choices: []});

            const result = await svc.suggestCategory(
                'Sobeys', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });

        it('returns null when content is an empty string', async () => {
            mockCreate.mockResolvedValue(openAiResponse(''));

            const result = await svc.suggestCategory(
                'Sobeys', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });

        it('returns null when the AI call throws', async () => {
            mockCreate.mockRejectedValue(new Error('network error'));

            const result = await svc.suggestCategory(
                'Test', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });
    });

    describe('Anthropic provider', () => {
        let mockCreate: ReturnType<typeof vi.fn>;
        let svc: AiCategorizationService;

        beforeEach(() => {
            mockCreate = vi.fn();
            svc = makeAnthropicService(mockCreate);
        });

        it('returns the category name for a valid JSON response', async () => {
            mockCreate.mockResolvedValue(
                anthropicResponse('{"category": "Income"}')
            );

            const result = await svc.suggestCategory(
                'Payroll deposit', 'income', CATEGORIES
            );

            expect(result).toBe('Income');
        });

        it('returns null for a non-text content block', async () => {
            mockCreate.mockResolvedValue(anthropicNonTextResponse());

            const result = await svc.suggestCategory(
                'Test', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });

        it('returns null for malformed JSON', async () => {
            mockCreate.mockResolvedValue(anthropicResponse('bad json'));

            const result = await svc.suggestCategory(
                'Test', 'expense', CATEGORIES
            );

            expect(result).toBeNull();
        });
    });

    describe('unavailable service', () => {
        it('returns null immediately without calling the AI client', () => {
            const config = makeConfig({
                AI_PROVIDER: 'openai',
                AI_MODEL: 'gpt-4o-mini',
                OPENAI_API_KEY: undefined
            });
            const svc = new AiCategorizationService(config);

            expect(svc.available).toBe(false);

            // Returns synchronously (no await needed) but declared async — still resolves null
            return expect(
                svc.suggestCategory('test', 'expense', CATEGORIES)
            ).resolves.toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// suggestCategories
// ---------------------------------------------------------------------------

describe('AiCategorizationService.suggestCategories', () => {
    describe('OpenAI provider — batch success', () => {
        let mockCreate: ReturnType<typeof vi.fn>;
        let svc: AiCategorizationService;

        beforeEach(() => {
            mockCreate = vi.fn();
            svc = makeOpenAiService(mockCreate);
        });

        it('returns a Map with the correct categories for a single chunk', async () => {
            const batchJson = JSON.stringify([
                {index: 0, category: 'Food & Dining'},
                {index: 1, category: 'Income'}
            ]);
            mockCreate.mockResolvedValue(openAiResponse(batchJson));

            const txs = [
                {id: 'tx-1', description: 'Sobeys', transactionType: 'expense'},
                {id: 'tx-2', description: 'Payroll', transactionType: 'income'}
            ];

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(result.get('tx-1')).toBe('Food & Dining');
            expect(result.get('tx-2')).toBe('Income');
        });

        it('sets null for transactions whose index is absent from the batch response', async () => {
            // Only returns index 0, omits index 1
            const batchJson = JSON.stringify([{index: 0, category: 'Housing'}]);
            mockCreate.mockResolvedValue(openAiResponse(batchJson));

            const txs = [
                {id: 'tx-a', description: 'Rent', transactionType: 'expense'},
                {id: 'tx-b', description: 'Unknown', transactionType: 'expense'}
            ];

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(result.get('tx-a')).toBe('Housing');
            expect(result.get('tx-b')).toBeNull();
        });

        it('processes multiple chunks when transactions exceed BATCH_SIZE', async () => {
            // Build 25 transactions — should trigger 2 AI calls (20 + 5)
            const txs = Array.from({length: 25}, (_, i) => ({
                id: `tx-${i}`,
                description: `Desc ${i}`,
                transactionType: 'expense'
            }));

            mockCreate.mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ({messages}: {messages: {role: string, content: string}[]}): any => {
                    // Parse how many transactions are in this chunk from the user message
                    const userMsg = messages[1].content;
                    const matches = userMsg.match(/^\[(\d+)\]/gm) ?? [];
                    const items = matches.map((_m, i) => ({index: i, category: 'Other'}));
                    return Promise.resolve(openAiResponse(JSON.stringify(items)));
                }
            );

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(mockCreate).toHaveBeenCalledTimes(2);
            expect(result.size).toBe(25);
            for (const tx of txs) {
                expect(result.get(tx.id)).toBe('Other');
            }
        });

        it('returns an empty Map for an empty transactions array', async () => {
            const result = await svc.suggestCategories([], CATEGORIES);

            expect(result.size).toBe(0);
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('falls back to individual suggestCategory calls on parse failure', async () => {
            // First call returns invalid JSON (chunk failure)
            mockCreate
                .mockResolvedValueOnce(openAiResponse('not valid json'))
                // Subsequent individual calls return valid single-category JSON
                .mockResolvedValue(openAiResponse('{"category": "Other"}'));

            const txs = [
                {id: 'tx-1', description: 'A', transactionType: 'expense'},
                {id: 'tx-2', description: 'B', transactionType: 'expense'}
            ];

            const result = await svc.suggestCategories(txs, CATEGORIES);

            // 1 batch attempt + 2 individual fallbacks = 3 calls
            expect(mockCreate).toHaveBeenCalledTimes(3);
            expect(result.get('tx-1')).toBe('Other');
            expect(result.get('tx-2')).toBe('Other');
        });

        it('falls back to individual calls when batch response is not a JSON array', async () => {
            mockCreate
                .mockResolvedValueOnce(openAiResponse('{"category": "Other"}'))
                .mockResolvedValue(openAiResponse('{"category": "Income"}'));

            const txs = [
                {id: 'tx-1', description: 'A', transactionType: 'income'}
            ];

            const result = await svc.suggestCategories(txs, CATEGORIES);

            // 1 batch attempt fails (object not array) + 1 individual
            expect(mockCreate).toHaveBeenCalledTimes(2);
            expect(result.get('tx-1')).toBe('Income');
        });

        it('makes exactly 1 AI call for exactly BATCH_SIZE (20) transactions', async () => {
            const txs = Array.from({length: 20}, (_, i) => ({
                id: `tx-${i}`,
                description: `Desc ${i}`,
                transactionType: 'expense'
            }));

            mockCreate.mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ({messages}: {messages: {role: string, content: string}[]}): any => {
                    const userMsg = messages[1].content;
                    const matches = userMsg.match(/^\[(\d+)\]/gm) ?? [];
                    const items = matches.map((_m, i) => ({index: i, category: 'Other'}));
                    return Promise.resolve(openAiResponse(JSON.stringify(items)));
                }
            );

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(mockCreate).toHaveBeenCalledTimes(1);
            expect(result.size).toBe(20);
            for (const tx of txs) {
                expect(result.get(tx.id)).toBe('Other');
            }
        });

        it('makes exactly 2 AI calls for 21 transactions (chunk of 20 + chunk of 1)', async () => {
            const txs = Array.from({length: 21}, (_, i) => ({
                id: `tx-${i}`,
                description: `Desc ${i}`,
                transactionType: 'expense'
            }));

            mockCreate.mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ({messages}: {messages: {role: string, content: string}[]}): any => {
                    const userMsg = messages[1].content;
                    const matches = userMsg.match(/^\[(\d+)\]/gm) ?? [];
                    const items = matches.map((_m, i) => ({index: i, category: 'Other'}));
                    return Promise.resolve(openAiResponse(JSON.stringify(items)));
                }
            );

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(mockCreate).toHaveBeenCalledTimes(2);
            expect(result.size).toBe(21);
            for (const tx of txs) {
                expect(result.get(tx.id)).toBe('Other');
            }
        });

        it('makes exactly 2 AI calls for 40 transactions (2 full chunks of 20)', async () => {
            const txs = Array.from({length: 40}, (_, i) => ({
                id: `tx-${i}`,
                description: `Desc ${i}`,
                transactionType: 'expense'
            }));

            mockCreate.mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ({messages}: {messages: {role: string, content: string}[]}): any => {
                    const userMsg = messages[1].content;
                    const matches = userMsg.match(/^\[(\d+)\]/gm) ?? [];
                    const items = matches.map((_m, i) => ({index: i, category: 'Other'}));
                    return Promise.resolve(openAiResponse(JSON.stringify(items)));
                }
            );

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(mockCreate).toHaveBeenCalledTimes(2);
            expect(result.size).toBe(40);
            for (const tx of txs) {
                expect(result.get(tx.id)).toBe('Other');
            }
        });

        it('falls back to individual calls when a batch item has wrong shape', async () => {
            // item missing "category" key
            const badJson = JSON.stringify([{index: 0, name: 'Food & Dining'}]);
            mockCreate
                .mockResolvedValueOnce(openAiResponse(badJson))
                .mockResolvedValue(openAiResponse('{"category": "Housing"}'));

            const txs = [
                {id: 'tx-1', description: 'Rent', transactionType: 'expense'}
            ];

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(result.get('tx-1')).toBe('Housing');
        });
    });

    describe('unavailable service', () => {
        it('disables when anthropic provider has no API key', async () => {
            const config = makeConfig({
                AI_PROVIDER: 'anthropic',
                AI_MODEL: 'claude-haiku-4-5-20251001',
                ANTHROPIC_API_KEY: undefined
            });
            const svc = new AiCategorizationService(config);
            const txs = [{id: 'tx-1', description: 'A', transactionType: 'expense'}];
            const result = await svc.suggestCategories(txs, CATEGORIES);
            expect(result.get('tx-1')).toBeNull();
        });

        it('returns a Map with all ids set to null without calling AI', async () => {
            const config = makeConfig({
                AI_PROVIDER: 'openai',
                AI_MODEL: 'gpt-4o-mini',
                OPENAI_API_KEY: undefined
            });
            const svc = new AiCategorizationService(config);

            const txs = [
                {id: 'tx-1', description: 'A', transactionType: 'expense'},
                {id: 'tx-2', description: 'B', transactionType: 'expense'}
            ];

            const result = await svc.suggestCategories(txs, CATEGORIES);

            expect(result.get('tx-1')).toBeNull();
            expect(result.get('tx-2')).toBeNull();
        });
    });
});
