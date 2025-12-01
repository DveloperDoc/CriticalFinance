import { IsUUID } from 'class-validator';

export class UpdateTransactionCategoryDto {
  @IsUUID()
  categoryId: string;
}
