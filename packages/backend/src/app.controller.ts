import {
    Controller, Get
} from '@nestjs/common';
import {AppService} from './app.service.js';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    public getHello(): string {
        return this.appService.getHello();
    }

    @Get('health')
    public healthCheck(): {status: string, timestamp: string} {
        return {
            status: 'ok',
            timestamp: new Date().toISOString()
        };
    }
}
