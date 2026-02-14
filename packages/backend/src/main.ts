import {NestFactory} from '@nestjs/core';
import {AppModule} from '@/app.module.js';

const bootstrap = async (): Promise<void> => {
    const app = await NestFactory.create(AppModule);
    await app.listen(process.env.PORT ?? 3000);
};
void bootstrap();
