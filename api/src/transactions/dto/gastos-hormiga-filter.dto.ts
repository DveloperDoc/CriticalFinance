// src/transactions/dto/gastos-hormiga-filter.dto.ts
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class GastosHormigaFilterDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsDateString()
  from?: string; // ISO date

  @IsOptional()
  @IsDateString()
  to?: string;   // ISO date
}
