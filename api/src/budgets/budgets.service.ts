// api/src/budgets/budgets.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudgetPeriod, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

type BudgetOverviewItem = {
  id: string;
  accountId: string;
  category: { id: string; name: string; color: string | null };
  amountCents: number;
  spentCents: number;
  remainingCents: number;
  progress: number; // 0..1
  isOver: boolean;
  period: BudgetPeriod;
};

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inicio de mes (UTC) */
  private getMonthStart(date = new Date()): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
    );
  }

  private getCurrentMonthRange() {
    const now = new Date();
    const start = this.getMonthStart(now);
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
    return { start, end };
  }

  // ----------------- CRUD BUDGETS -----------------

  /**
   * POST /budgets
   * Crea o actualiza (upsert) un presupuesto por:
   *   userId + accountId + categoryId + period
   */
  async upsert(userId: string, dto: CreateBudgetDto) {
    const { accountId, categoryId, amountCents } = dto;
    const period: BudgetPeriod = dto.period ?? BudgetPeriod.monthly;

    if (!accountId) {
      throw new BadRequestException('Debe indicar la cuenta del presupuesto.');
    }
    if (!categoryId) {
      throw new BadRequestException('Debe indicar la categoría del presupuesto.');
    }
    if (!amountCents || amountCents <= 0) {
      throw new BadRequestException(
        'El monto del presupuesto debe ser mayor a 0.',
      );
    }

    // validar que la cuenta pertenezca al usuario y esté activa
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, active: true },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        'La cuenta no existe o no pertenece al usuario.',
      );
    }

    // validar que la categoría pertenezca al usuario
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException(
        'La categoría no existe o no pertenece al usuario.',
      );
    }

    // ¿ya existe un presupuesto para esta combinación?
    const existing = await this.prisma.budget.findFirst({
      where: {
        userId,
        accountId,
        categoryId,
        period,
      },
    });

    if (existing) {
      // solo actualizamos monto y periodo
      return this.prisma.budget.update({
        where: { id: existing.id },
        data: {
          amountCents,
          period,
        },
      });
    }

    // si no existe, creamos uno nuevo con startMonth = primer día del mes actual
    const startMonth = this.getMonthStart(
      dto.startMonth ? new Date(dto.startMonth) : new Date(),
    );

    return this.prisma.budget.create({
      data: {
        userId,
        accountId,
        categoryId,
        amountCents,
        period,
        startMonth,
      },
    });
  }

  /**
   * GET /budgets
   * Lista "cruda" de presupuestos del usuario (todas las cuentas).
   */
  async getAll(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: {
        category: { select: { id: true, name: true, color: true } },
        account: {
          select: {
            id: true,
            bank: true,
            alias: true,
            accountNumber: true,
            currency: true,
          },
        },
      },
      orderBy: {
        startMonth: 'asc',
      },
    });

    return budgets;
  }

  /**
   * GET /budgets/overview?accountId=...
   * Summary mensual del mes actual:
   *   - amountCents (límite)
   *   - spentCents (gasto este mes)
   *   - remainingCents
   *   - progress (0..1)
   *   - isOver
   *
   * Si viene accountId → solo esa cuenta.
   * Si no viene → todas las cuentas del usuario.
   */
  async getOverview(
    userId: string,
    accountId?: string,
  ): Promise<BudgetOverviewItem[]> {
    const { start, end } = this.getCurrentMonthRange();

    // 1) Presupuestos relevantes
    const budgets = await this.prisma.budget.findMany({
      where: {
        userId,
        ...(accountId ? { accountId } : {}),
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: {
        startMonth: 'asc',
      },
    });

    if (budgets.length === 0) return [];

    const accountIds = Array.from(new Set(budgets.map((b) => b.accountId)));
    const categoryIds = Array.from(new Set(budgets.map((b) => b.categoryId)));

    // 2) Transacciones de este mes que afectan a esas cuentas/categorías
    const txs = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        categoryId: { in: categoryIds },
        type: TransactionType.debit, // solo gastos
        bookedAt: {
          gte: start,
          lt: end,
        },
        account: { userId },
      },
      select: {
        accountId: true,
        categoryId: true,
        valueCents: true, // negativo
      },
    });

    // 3) Agrupar gasto por (accountId, categoryId)
    const spentMap = new Map<string, number>();

    for (const tx of txs) {
      const key = `${tx.accountId}:${tx.categoryId}`;
      const prev = spentMap.get(key) ?? 0;
      const abs = Math.abs(tx.valueCents ?? 0);
      spentMap.set(key, prev + abs);
    }

    // 4) Construir overview
    const overview: BudgetOverviewItem[] = budgets.map((b) => {
      const key = `${b.accountId}:${b.categoryId}`;
      const spentCents = spentMap.get(key) ?? 0;

      const remainingCents = Math.max(0, b.amountCents - spentCents);
      const progress =
        b.amountCents > 0 ? Math.min(1, spentCents / b.amountCents) : 0;
      const isOver = spentCents > b.amountCents;

      return {
        id: b.id,
        accountId: b.accountId,
        category: b.category,
        amountCents: b.amountCents,
        spentCents,
        remainingCents,
        progress,
        isOver,
        period: b.period,
      };
    });

    return overview;
  }

  /**
   * DELETE /budgets/:id
   */
  async remove(userId: string, id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget || budget.userId !== userId) {
      throw new NotFoundException('Presupuesto no encontrado');
    }

    await this.prisma.budget.delete({ where: { id } });
    return { ok: true };
  }
}
