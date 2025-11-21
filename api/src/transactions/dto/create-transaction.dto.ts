// src/transactions/dto/create-transaction.dto.ts
import { TransactionType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  accountId: string;

  @IsInt()
  valueCents: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString()
  bookedAt: string; // ISO

  @IsOptional()
  @IsDateString()
  postedAt?: string;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}
