// src/savings/dto/create-savings-rule.dto.ts
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSavingsRuleDto {
  @IsString()
  accountId: string;

  @IsInt()
  @Min(0)
  thresholdCents: number;

  // margen opcional → si no viene, el service lo setea a 0
  @IsOptional()
  @IsInt()
  @Min(0)
  notifyMarginCents?: number = 0;
}
