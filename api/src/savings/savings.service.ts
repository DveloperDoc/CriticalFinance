// src/savings/savings.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsRuleDto } from './dto/create-savings-rule.dto';

@Injectable()
export class SavingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(userId: string, dto: CreateSavingsRuleDto) {
    console.log('[SavingsService] createRule dto=', dto, 'userId=', userId);

    const account = await this.prisma.account.findFirst({
      where: {
        id: dto.accountId,
        userId,
        active: true,
      },
      select: { id: true },
    });

    console.log('[SavingsService] account found =', account);

    if (!account) {
      throw new BadRequestException('La cuenta no existe o no pertenece al usuario');
    }

    const rule = await this.prisma.savingsRule.create({
      data: {
        userId,
        accountId: account.id,
        thresholdCents: dto.thresholdCents,
        notifyMarginCents: dto.notifyMarginCents ?? null,
      },
    });

    console.log('[SavingsService] rule created =', rule.id);

    return rule;
  }

  async listRules(userId: string) {
    return this.prisma.savingsRule.findMany({
      where: { userId, active: true },
      include: {
        account: {
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAlerts(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
