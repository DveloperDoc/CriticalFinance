// src/transactions/transactions.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTransactionDto) {
    // validar que la cuenta pertenece al usuario
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new Error('Account not found or not owned by user');
    }

    return this.prisma.transaction.create({
      data: {
        accountId: dto.accountId,
        valueCents: dto.valueCents,
        type: dto.type,
        bookedAt: new Date(dto.bookedAt),
        postedAt: dto.postedAt ? new Date(dto.postedAt) : null,
        merchant: dto.merchant ?? null,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        externalId: dto.externalId ?? null,
        // fields ML se podrán llenar después
      },
    });
  }

  async findAll(userId: string, filter: FilterTransactionsDto) {
    const { accountId, from, to, categoryId } = filter;

    return this.prisma.transaction.findMany({
      where: {
        account: {
          userId,
        },
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        bookedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        category: true,
        mlPredictedCategory: true,
      },
      orderBy: { bookedAt: 'desc' },
      take: 200, // límite razonable para móvil
    });
  }
}
