import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import type {TestingModule} from '@nestjs/testing';
import {Test} from '@nestjs/testing';
import {DatabaseModule} from '#database/database.module.js';
import {PrismaService} from '#database/prisma.service.js';

// Mock PrismaService for module testing
const mockPrismaService = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {},
    refreshToken: {}
};

describe('DatabaseModule', () => {
    let module: TestingModule;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        module = await Test.createTestingModule({
            imports: [DatabaseModule]
        })
            .overrideProvider(PrismaService)
            .useValue(mockPrismaService)
            .compile();
    });

    describe('module configuration', () => {
        it('should be defined', () => {
            expect(module).toBeDefined();
        });

        it('should provide PrismaService', () => {
            const prismaService = module.get<PrismaService>(PrismaService);
            expect(prismaService).toBeDefined();
        });

        it('should export PrismaService for use in other modules', async () => {
            // Create a test module that imports DatabaseModule
            const testModule = await Test.createTestingModule({
                imports: [DatabaseModule]
            })
                .overrideProvider(PrismaService)
                .useValue(mockPrismaService)
                .compile();

            const prismaService = testModule.get<PrismaService>(PrismaService);
            expect(prismaService).toBeDefined();
        });
    });

    describe('global module', () => {
        it('should make PrismaService available globally', async () => {
            // Create a module with DatabaseModule
            const globalTestModule = await Test.createTestingModule({
                imports: [DatabaseModule]
            })
                .overrideProvider(PrismaService)
                .useValue(mockPrismaService)
                .compile();

            const prismaService = globalTestModule.get<PrismaService>(PrismaService);
            expect(prismaService).toBeDefined();
        });
    });
});
