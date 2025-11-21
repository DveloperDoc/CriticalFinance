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
import { RegisterDto } from './dto/register.dto'; // 👈 nuevo

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

  // 👇 NUEVO: registro de usuario
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    // crea el usuario (lanza error si el email ya existe)
    const user = await this.auth.register(dto.name, dto.email, dto.password);
    // si quisieras podrías devolver también token, pero tu app móvil
    // ya hace login después, así que con el usuario basta
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
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
