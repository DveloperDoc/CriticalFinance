// src/transactions/transactions.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type FindAllParams = {
  userId: string;            // <-- nuevo
  accountId?: string;
  take?: number;
  skip?: number;
  from?: string;
  to?: string;
};

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll({ userId, accountId, take = 100, skip = 0, from, to }: FindAllParams) {
    // Si filtras por accountId, verifica que la cuenta pertenezca al usuario
    if (accountId) {
      const acc = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
      if (!acc) throw new ForbiddenException('Cuenta no encontrada para este usuario');
    }

    const where: Prisma.TransactionWhereInput = {
      // Siempre limita por dueño
      account: { userId },
      ...(accountId ? { accountId } : {}),
      ...(from || to
        ? {
            bookedAt: {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined,
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { bookedAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          bookedAt: true,
          valueCents: true,
          type: true,
          description: true,
          merchant: true,
          categoryId: true,
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { total, items };
  }
}