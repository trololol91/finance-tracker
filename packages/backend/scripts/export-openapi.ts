/**
 * Export OpenAPI specification to a JSON snapshot file.
 *
 * This script boots the NestJS app (without listening on a port), builds the
 * Swagger document, and writes it to `packages/frontend/openapi.json` so that
 * Orval can generate the frontend API client without the backend needing to be
 * running.
 *
 * Usage (from packages/backend):
 *   npx ts-node --esm scripts/export-openapi.ts
 *   or via the package.json script:
 *   npm run export:openapi
 */

import {NestFactory} from '@nestjs/core';
import {
    DocumentBuilder, SwaggerModule
} from '@nestjs/swagger';
import {writeFileSync} from 'fs';
import {
    resolve, dirname
} from 'path';
import {fileURLToPath} from 'url';
import {AppModule} from '../src/app.module.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const exportSpec = async (): Promise<void> => {
    // Create app without HTTP adapter to avoid starting a server
    const app = await NestFactory.create(AppModule, {logger: false});

    const config = new DocumentBuilder()
        .setTitle('Finance Tracker API')
        .setDescription('RESTful API for personal finance tracking application')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT token'
            },
            'JWT-auth'
        )
        .addTag('users', 'User management operations')
        .addTag('auth', 'Authentication operations')
        .addTag('transactions', 'Transaction management')
        .addTag('categories', 'Category management')
        .addTag('accounts', 'Account management')
        .addTag('budgets', 'Budget management')
        .addTag('reports', 'Financial reports and analytics')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    const outputPath = resolve(__dirname, '../../frontend/openapi.json');
    writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

    console.log(`✓ OpenAPI spec written to: ${outputPath}`);

    await app.close();
};

void exportSpec();
