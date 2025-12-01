// api/src/users/dto/register-push-token.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
