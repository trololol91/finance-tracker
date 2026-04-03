import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {envValidationSchema} from './config/env.validation.js';
import {AppController} from './app.controller.js';
import {AppService} from './app.service.js';
import {CommonModule} from '#common/common.module.js';
import {DatabaseModule} from '#database/database.module.js';
import {TransactionsModule} from '#transactions/transactions.module.js';
import {UsersModule} from '#users/users.module.js';
import {AuthModule} from '#auth/auth.module.js';
import {CategoriesModule} from '#categories/categories.module.js';
import {AccountsModule} from '#accounts/accounts.module.js';
import {ScraperModule} from '#scraper/scraper.module.js';
import {DashboardModule} from '#dashboard/dashboard.module.js';
import {AiCategorizationModule} from '#ai-categorization/index.js';
import {CategoryRulesModule} from '#category-rules/category-rules.module.js';
import {ApiTokensModule} from '#api-tokens/api-tokens.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            validationSchema: envValidationSchema,
            validationOptions: {abortEarly: false}
        }),
        DatabaseModule,
        CommonModule,
        UsersModule,
        AuthModule,
        TransactionsModule,
        CategoriesModule,
        AccountsModule,
        ScraperModule,
        DashboardModule,
        AiCategorizationModule,
        CategoryRulesModule,
        ApiTokensModule
    ],
    controllers: [AppController],
    providers: [AppService]
})
export class AppModule {}
