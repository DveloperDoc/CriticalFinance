// src/savings/savings.module.ts
import { Module } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SavingsController],
  providers: [SavingsService, PrismaService],
})
export class SavingsModule {}
