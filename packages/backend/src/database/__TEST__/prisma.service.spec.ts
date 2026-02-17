import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import type {ConfigService} from '@nestjs/config';
import {PrismaService} from '#database/prisma.service.js';

// Mock pg and adapter
vi.mock('pg', () => {
    const PoolMock = function() {
        return {};
    };
    return {
        default: {Pool: PoolMock}
    };
});

vi.mock('@prisma/adapter-pg', () => {
    const PrismaPgMock = function() {
        return {};
    };
    return {
        PrismaPg: PrismaPgMock
    };
});

vi.mock('#generated/prisma/client.js', () => {
    class MockPrismaClient {
        constructor() {}
    }
    return {
        PrismaClient: MockPrismaClient
    };
});

describe('PrismaService', () => {
    let prismaService: PrismaService;
    let mockConfigService: ConfigService;

    beforeEach(() => {
        vi.clearAllMocks();
        const databaseUrl = 'postgresql://test:test@localhost:5432/test';
        
        // Mock ConfigService
        mockConfigService = {
            get: vi.fn().mockReturnValue(databaseUrl)
        } as unknown as ConfigService;
        
        prismaService = new PrismaService(mockConfigService);
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(prismaService).toBeDefined();
        });

        it('should extend PrismaClient', () => {
            expect(prismaService).toBeInstanceOf(PrismaService);
        });
    });
});
