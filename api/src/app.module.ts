// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Core
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

// Dominio financiero
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';

// Ahorro + Alertas
import { SavingsModule } from './savings/savings.module';
import { AlertsModule } from './alerts/alerts.module';

// ML
import { MlModule } from './ml/ml.module';

// Notificaciones push
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Infra
    PrismaModule,
    AuthModule,
    UsersModule,

    // Core del dominio
    AccountsModule,
    TransactionsModule,
    CategoriesModule,
    BudgetsModule,

    // Ahorros + Alertas
    SavingsModule,
    AlertsModule,

    // ML
    MlModule,

    // Push / notificaciones
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
