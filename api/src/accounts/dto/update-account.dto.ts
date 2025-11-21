// src/accounts/dto/update-account.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
