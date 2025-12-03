import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /categories
   *
   * Parámetro opcional:
   *   ?onlyRoots=true   → solo categorías macro (parentId = null, deduplicadas por nombre)
   *   ?onlyRoots=false  → todas las categorías (macro + hijas, sin deduplicar)
   *
   * Por defecto: SOLO categorías macro, sin duplicados por nombre.
   */
  @Get()
  async list(
    @Req() req: any,
    @Query('onlyRoots') onlyRoots?: string,
  ) {
    const userId = req.user.userId as string;

    const filterRoots =
      onlyRoots === undefined || onlyRoots === 'true' || onlyRoots === '1';

    // 1) Traer categorías desde Prisma
    const raw = await this.prisma.category.findMany({
      where: {
        userId,
        ...(filterRoots ? { parentId: null } : {}), // solo padres si onlyRoots=true
      },
      select: {
        id: true,
        name: true,
        color: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
    });

    // 2) Si soloRoots → deduplicar por nombre (para que en el modal no salgan 20 "Servicios")
    if (filterRoots) {
      const byName = new Map<string, (typeof raw)[number]>();

      for (const c of raw) {
        const key = c.name.trim().toLowerCase();
        if (!byName.has(key)) {
          byName.set(key, c);
        }
      }

      // devolver ya ordenadas por nombre
      return Array.from(byName.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      );
    }

    // Si onlyRoots=false → devolvemos todas tal cual
    return raw;
  }
}
