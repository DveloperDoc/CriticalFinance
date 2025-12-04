// api/src/categories/categories.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve las categorías principales (macro) del usuario,
   * excluyendo las categorías de transferencias que no deben
   * usarse como categorías limitantes de presupuesto.
   */
  async findAllForUser(userId: string) {
    return this.prisma.category.findMany({
      where: {
        userId,
        parentId: null, // solo categorías macro
        name: {
          notIn: [
            'Transferencias enviadas',
            'Transferencias recibidas',
            'Transferencias entre cuentas',
          ],
        },
      },
      select: {
        id: true,
        name: true,
        color: true,
        parentId: true, // se mantiene por si el front lo necesita
      },
      orderBy: { name: 'asc' },
    });
  }
}
