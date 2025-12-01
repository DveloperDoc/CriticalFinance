// src/budgets/dto/create-budget.dto.ts
import { IsString, IsInt, IsOptional, IsEnum, IsISO8601, Min } from 'class-validator';
import { BudgetPeriod } from '@prisma/client';

export class CreateBudgetDto {
  @IsString()
  categoryId: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;

  @IsOptional()
  @IsISO8601()
  startMonth?: string; // ISO, se normaliza al 1° del mes
}
