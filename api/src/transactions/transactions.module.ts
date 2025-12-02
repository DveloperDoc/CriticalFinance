// api/src/transactions/transactions.module.ts
import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MlModule } from '../ml/ml.module';
import { SavingsModule } from '../savings/savings.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [MlModule, SavingsModule, AlertsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, PrismaService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
