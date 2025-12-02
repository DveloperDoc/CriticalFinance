// src/savings/savings.module.ts
import { Module } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SavingsRuleEvaluatorService } from './savings-rule-evaluator.service';

@Module({
  controllers: [SavingsController],
  providers: [
    SavingsService,
    SavingsRuleEvaluatorService,
    PrismaService,
  ],
  exports: [
    SavingsService,              //Exportado
    SavingsRuleEvaluatorService, //Exportado
  ],
})
export class SavingsModule {}
