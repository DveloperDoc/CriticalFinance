// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // .env disponible en todo el proyecto
    PrismaModule,
    AuthModule,           // <-- añade autenticación JWT
    TransactionsModule,   // <-- tus endpoints de movimientos
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}