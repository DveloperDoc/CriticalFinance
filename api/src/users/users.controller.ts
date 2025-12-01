// api/src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller() // rutas: /me, /me/push-token
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user.id as string;

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        rut: true,
        phone: true,
        accounts: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            currency: true,
            balanceCents: true,
            createdAt: true,
          },
        },
      },
    });
  }

  @Post('me/push-token')
  async savePushToken(
    @Req() req: any,
    @Body('token') token: string,
    @Body('platform') platform?: string,
  ) {
    const userId = req.user.id as string;

    // Validación mínima del token
    if (!token || typeof token !== 'string' || token.length < 10) {
      throw new BadRequestException('token de push inválido');
    }

    console.log(
      '[UsersController] Guardando pushToken para user:',
      userId,
      'token:',
      token,
      'platform:',
      platform,
    );

    // Upsert según la clave única @@unique([userId, token], "user_token")
    await this.prisma.pushToken.upsert({
      where: {
        user_token: {
          userId,
          token,
        },
      },
      update: { platform },
      create: {
        userId,
        token,
        platform,
      },
    });

    return { ok: true };
  }
}
