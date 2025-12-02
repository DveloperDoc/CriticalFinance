// src/transactions/dto/create-transaction.dto.ts
import { TransactionType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  accountId: string;

  @IsInt()
  valueCents: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString()
  bookedAt: string;

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

  // NUEVO (opcional): features internas
  @IsOptional()
  @IsObject()
  features?: any;
}
