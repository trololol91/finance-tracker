import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaClient} from '#generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';

/**
 * Prisma service providing database client with PostgreSQL adapter
 */
@Injectable()
export class PrismaService extends PrismaClient {
    /**
     * Initialize Prisma client with database connection from configuration
     * @param configService - Configuration service to read DATABASE_URL
     */
    constructor(configService: ConfigService) {
        const connectionString = configService.get<string>('DATABASE_URL');
        const adapter = new PrismaPg({connectionString});
        super({adapter});
    }
}
