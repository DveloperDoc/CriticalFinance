import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.auth.validate(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const access_token = await this.auth.sign(user.id, user.email);
    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    // Según tu JwtStrategy, normalmente req.user.id o req.user.sub
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Token inválido');
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        accounts: {
          select: {
            id: true,
            bank: true,
            accountType: true,
            accountNumber: true,
            alias: true,
            balanceCents: true,
            currency: true,
          },
        },
      },
    });
  }
}
