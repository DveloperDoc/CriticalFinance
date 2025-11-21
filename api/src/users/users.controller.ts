import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller() // ruta exacta: /me
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  async me(@Req() req: any) {
    // JwtStrategy ahora retorna { id, email }
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
}
