// src/accounts/dto/create-account.dto.ts
import { AccountType, Currency } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  bank: string;

  @IsEnum(AccountType)
  accountType: AccountType;

  @IsString()
  accountNumber: string;

  @IsString()
  holderName: string;

  @IsOptional()
  @IsString()
  rutTitular?: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  providerRef?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
