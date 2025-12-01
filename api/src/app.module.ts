// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

// NUEVOS MÓDULOS
import { AccountsModule } from './accounts/accounts.module';
import { SavingsModule } from './savings/savings.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { AlertsModule } from './alerts/alerts.module';

// ML MODULE
import { MlModule } from './ml/ml.module';

// Notifications
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,

    AccountsModule,
    TransactionsModule,
    SavingsModule,
    BudgetsModule,
    CategoriesModule,

    MlModule,
    NotificationsModule,
    AlertsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
