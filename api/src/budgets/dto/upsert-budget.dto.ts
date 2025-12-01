// api/src/budgets/dto/upsert-budget.dto.ts
import { IsUUID, IsInt, Min, IsEnum } from 'class-validator';
import { BudgetPeriod } from '@prisma/client';

export class UpsertBudgetDto {
  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(0)
  amountCents: number;

  @IsEnum(BudgetPeriod)
  period: BudgetPeriod; // 'monthly' | 'weekly' | 'yearly'
}
