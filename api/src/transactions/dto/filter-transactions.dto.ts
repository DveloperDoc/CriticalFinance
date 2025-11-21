// src/transactions/dto/filter-transactions.dto.ts
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FilterTransactionsDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
