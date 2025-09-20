import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  findAll(params: {
    accountId?: string;
    take?: number;
    skip?: number;
    from?: string; // ISO
    to?: string;   // ISO
  }) {
    const { accountId, take = 50, skip = 0, from, to } = params;
    return this.prisma.transaction.findMany({
      where: {
        ...(accountId ? { accountId } : {}),
        ...(from || to
          ? {
              bookedAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { bookedAt: 'desc' },
      take,
      skip,
      include: { category: true },
    });
  }
}