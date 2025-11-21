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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // .env disponible en todo el proyecto
    PrismaModule,
    AuthModule,           // autenticación JWT
    UsersModule,          // gestión de usuarios
    AccountsModule,       // cuentas bancarias
    TransactionsModule,   // movimientos / transacciones
    SavingsModule,        // reglas de ahorro + alertas
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
