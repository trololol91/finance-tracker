import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import type {TestingModule} from '@nestjs/testing';
import {Test} from '@nestjs/testing';
import {ConfigModule} from '@nestjs/config';
import {DatabaseModule} from '#database/database.module.js';
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

describe('DatabaseModule', () => {
    let module: TestingModule;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
        
        module = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env'
                }),
                DatabaseModule
            ]
        }).compile();
    });

    describe('module configuration', () => {
        it('should be defined', () => {
            expect(module).toBeDefined();
        });

        it('should provide PrismaService', () => {
            const prismaService = module.get<PrismaService>(PrismaService);
            expect(prismaService).toBeDefined();
            expect(prismaService).toBeInstanceOf(PrismaService);
        });

        it('should export PrismaService for use in other modules', async () => {
            // Create a test module that imports DatabaseModule
            const testModule = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        isGlobal: true,
                        envFilePath: '.env'
                    }),
                    DatabaseModule
                ],
                providers: []
            }).compile();

            const prismaService = testModule.get<PrismaService>(PrismaService);
            expect(prismaService).toBeDefined();
        });
    });

    describe('global module', () => {
        it('should make PrismaService available globally', async () => {
            // Create a module with ConfigModule and DatabaseModule
            const globalTestModule = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        isGlobal: true,
                        envFilePath: '.env'
                    }),
                    DatabaseModule
                ],
                providers: []
            }).compile();

            const prismaService = globalTestModule.get<PrismaService>(PrismaService);
            expect(prismaService).toBeDefined();
        });
    });
});
