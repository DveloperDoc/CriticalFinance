import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.category.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }
}
