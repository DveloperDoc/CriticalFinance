// api/src/categories/categories.controller.ts
import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private prisma: PrismaService) {}

  private getUserId(req: any): string {
    const userId =
      req.user?.userId ??
      req.user?.id ??
      req.user?.sub;

    if (!userId) {
      throw new Error('No se pudo determinar el usuario desde el token.');
    }

    return String(userId);
  }

  /**
   * GET /categories
   *
   * Parámetro opcional:
   *   ?onlyRoots=true   → solo categorías macro (parentId = null, deduplicadas por nombre)
   *   ?onlyRoots=false  → todas las categorías (macro + hijas, sin deduplicar)
   *
   * Por defecto: SOLO categorías macro, sin duplicados por nombre.
   *
   * Además, se excluyen categorías de transferencias para que no se usen
   * como categorías limitantes de presupuesto.
   */
  @Get()
  async list(
    @Req() req: any,
    @Query('onlyRoots') onlyRoots?: string,
  ) {
    const userId = this.getUserId(req);

    const filterRoots =
      onlyRoots === undefined || onlyRoots === 'true' || onlyRoots === '1';

    // Nombres a excluir de la lista (transferencias)
    const EXCLUDED = [
      'Transferencias enviadas',
      'Transferencias recibidas',
      'Transferencias entre cuentas',
    ];

    // 1) Traer categorías desde Prisma
    const raw = await this.prisma.category.findMany({
      where: {
        userId,
        ...(filterRoots ? { parentId: null } : {}), // solo padres si onlyRoots=true
        NOT: {
          name: { in: EXCLUDED },
        },
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

    // Si onlyRoots=false → devolvemos todas tal cual (pero sin las transferencias)
    return raw;
  }
}
