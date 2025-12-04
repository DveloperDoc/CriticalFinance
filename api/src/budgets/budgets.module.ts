// api/src/budgets/budgets.module.ts
import { Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsModule } from '../alerts/alerts.module';
import { AlertsService } from '../alerts/alerts.service';

@Module({
  imports: [AlertsModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, PrismaService,AlertsService],
})
export class BudgetsModule {}
