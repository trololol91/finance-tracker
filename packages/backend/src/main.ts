import {NestFactory} from '@nestjs/core';
import {ValidationPipe} from '@nestjs/common';
import {
    DocumentBuilder, SwaggerModule
} from '@nestjs/swagger';
import {AppModule} from './app.module.js';

const bootstrap = async (): Promise<void> => {
    const app = await NestFactory.create(AppModule);

    // Enable validation pipes globally
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    }));

    // Swagger Configuration
    const config = new DocumentBuilder()
        .setTitle('Finance Tracker API')
        .setDescription('RESTful API for personal finance tracking application')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                description: 'Enter JWT token',
                in: 'header'
            },
            'JWT-auth' // This name will be used in @ApiBearerAuth() decorator
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
    SwaggerModule.setup('api', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha'
        }
    });

    await app.listen(process.env.PORT ?? 3001);
    console.log(`Application is running on: ${await app.getUrl()}`);
    console.log(`Swagger documentation: ${await app.getUrl()}/api`);
};
void bootstrap();
