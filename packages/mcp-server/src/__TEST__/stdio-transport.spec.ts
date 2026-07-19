import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

const {mockValidateBearerToken, mockCreateMcpServer} = vi.hoisted(() => ({
    mockValidateBearerToken: vi.fn(),
    mockCreateMcpServer: vi.fn()
}));

vi.mock('../server.js', () => ({
    validateBearerToken: mockValidateBearerToken,
    createMcpServer: mockCreateMcpServer,
    ALL_TOOLS: [{}, {}, {}]
}));

// Avoids wiring a real transport onto process.stdin/stdout during tests.
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
    class FakeStdioServerTransport {}
    return {StdioServerTransport: FakeStdioServerTransport};
});

const {startStdioServer} = await import('../stdio-transport.js');

describe('startStdioServer', () => {
    const originalToken = process.env.FINANCE_TRACKER_API_TOKEN;
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockValidateBearerToken.mockReset();
        mockCreateMcpServer.mockReset().mockReturnValue({
            connect: vi.fn().mockResolvedValue(undefined)
        });
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        // process.exit is typed as `never`; mocking it to throw (rather than
        // just recording the call) makes it actually halt execution here the
        // way the real call would, so the code after it doesn't run unmocked.
        exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
            throw new Error(`process.exit(${String(code)})`);
        });
    });

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.FINANCE_TRACKER_API_TOKEN;
        } else {
            process.env.FINANCE_TRACKER_API_TOKEN = originalToken;
        }
        vi.restoreAllMocks();
    });

    it('exits with an error when FINANCE_TRACKER_API_TOKEN is unset', async () => {
        delete process.env.FINANCE_TRACKER_API_TOKEN;

        await expect(startStdioServer()).rejects.toThrow('process.exit(1)');

        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('FINANCE_TRACKER_API_TOKEN is required in stdio mode')
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(mockValidateBearerToken).not.toHaveBeenCalled();
    });

    it('exits with an error when the token is rejected by the backend', async () => {
        process.env.FINANCE_TRACKER_API_TOKEN = 'bad-token';
        mockValidateBearerToken.mockResolvedValue(null);

        await expect(startStdioServer()).rejects.toThrow('process.exit(1)');

        expect(mockValidateBearerToken).toHaveBeenCalledWith('Bearer bad-token');
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('FINANCE_TRACKER_API_TOKEN is invalid or expired')
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(mockCreateMcpServer).not.toHaveBeenCalled();
    });

    it('connects the stdio transport and logs readiness for a valid token', async () => {
        process.env.FINANCE_TRACKER_API_TOKEN = 'good-token';
        mockValidateBearerToken.mockResolvedValue('good-token');
        const connect = vi.fn().mockResolvedValue(undefined);
        mockCreateMcpServer.mockReturnValue({connect});

        await startStdioServer();

        expect(mockCreateMcpServer).toHaveBeenCalledWith('good-token');
        expect(connect).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('stdio transport ready (3 tools)')
        );
        expect(exitSpy).not.toHaveBeenCalled();
    });
});
