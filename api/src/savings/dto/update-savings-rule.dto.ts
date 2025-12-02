// api/src/savings/dto/update-savings-rule.dto.ts
import { IsInt, Min, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSavingsRuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  thresholdCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  notifyMarginCents?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
