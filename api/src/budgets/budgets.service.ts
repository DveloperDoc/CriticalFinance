// api/src/budgets/budgets.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  BudgetPeriod,
  TransactionType,
  AlertType,
  AlertSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class BudgetsService {
  constructor(
    private prisma: PrismaService,
    private alertsService: AlertsService,
  ) {}

  // Primer día del mes actual (UTC)
  private getCurrentMonthStart(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    );
  }

  // Normaliza startMonth del DTO (ISO) → primer día del mes (UTC).
  private normalizeStartMonth(startMonth?: string): Date {
    if (!startMonth) return this.getCurrentMonthStart();

    const d = new Date(startMonth);
    if (isNaN(d.getTime())) {
      throw new BadRequestException(
        'startMonth debe ser una fecha ISO válida',
      );
    }

    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0),
    );
  }

  // Rango [from, to) según el tipo de periodo
  private getPeriodRange(
    start: Date,
    period: BudgetPeriod,
  ): { from: Date; to: Date } {
    const from = start;
    const to = new Date(start.getTime());

    switch (period) {
      case BudgetPeriod.weekly:
        to.setUTCDate(to.getUTCDate() + 7);
        break;
      case BudgetPeriod.yearly:
        to.setUTCFullYear(to.getUTCFullYear() + 1);
        break;
      case BudgetPeriod.monthly:
      default:
        to.setUTCMonth(to.getUTCMonth() + 1);
        break;
    }

    return { from, to };
  }

  /**
   * POST /budgets  → upsert por (userId, accountId, categoryId, period)
   * SIN usar unique compuesto en el where (para evitar problemas de tipos),
   * hacemos:
   *  - findFirst(...)
   *  - si existe → update por id
   *  - si no → create
   */
  async upsert(userId: string, dto: CreateBudgetDto) {
    if (!userId) {
      throw new BadRequestException(
        'userId no definido al guardar presupuesto.',
      );
    }

    if (!dto.accountId) {
      throw new BadRequestException(
        'accountId es obligatorio para el presupuesto.',
      );
    }

    const accountId = dto.accountId;
    const period = dto.period ?? BudgetPeriod.monthly;
    const startMonth = this.normalizeStartMonth(dto.startMonth);

    try {
      // 1) Buscar si ya existe presupuesto para (userId, accountId, categoryId, period)
      const existing = await this.prisma.budget.findFirst({
        where: {
          userId,
          accountId,
          categoryId: dto.categoryId,
          period,
        },
        select: { id: true },
      });

      if (existing) {
        // 2) Si existe, actualizamos monto y startMonth
        const budget = await this.prisma.budget.update({
          where: { id: existing.id },
          data: {
            amountCents: dto.amountCents,
            startMonth,
          },
        });
        return budget;
      }

      // 3) Si no existe, creamos uno nuevo
      const budget = await this.prisma.budget.create({
        data: {
          userId,
          accountId,
          categoryId: dto.categoryId,
          amountCents: dto.amountCents,
          period,
          startMonth,
        },
      });

      return budget;
    } catch (e: any) {
      console.error('Error Prisma al upsert budget', e);

      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2003') {
          throw new BadRequestException(
            'Categoría o cuenta inválida para este presupuesto.',
          );
        }
        if (e.code === 'P2002') {
          throw new BadRequestException(
            'Ya existe un presupuesto para esa categoría, cuenta y período.',
          );
        }
      }

      throw new BadRequestException('No se pudo guardar el presupuesto.');
    }
  }

  // DELETE /budgets/:id
  async remove(userId: string, id: string) {
    return this.prisma.budget.deleteMany({
      where: { id, userId },
    });
  }

  // GET /budgets → lista simple de presupuestos del usuario (todas las cuentas)
  async getAll(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: {
        category: true,
        account: true,
      },
      orderBy: [
        { startMonth: 'desc' },
        { period: 'asc' },
        { category: { name: 'asc' } },
      ],
    });

    // devolver startMonth como "YYYY-MM" para el frontend
    return budgets.map((b) => ({
      ...b,
      startMonth: b.startMonth.toISOString().slice(0, 7),
    }));
  }

  /**
   * GET /budgets/overview → lo que consume ahorro.tsx
   * Si viene accountId, filtra por esa cuenta (presupuestos y transacciones).
   */
  async getOverview(userId: string, accountId?: string) {
    const monthStart = this.getCurrentMonthStart();

    // 1) Leer alertas de presupuesto existentes este mes para evitar spam
    const existingBudgetAlerts = await this.prisma.alert.findMany({
      where: {
        userId,
        type: AlertType.budget_over,
        source: AlertSource.system,
        createdAt: { gte: monthStart },
      },
    });

    // Set con claves "categoryId:near" o "categoryId:over"
    const existingKeys = new Set<string>();
    for (const a of existingBudgetAlerts) {
      const payload: any = (a as any).payload ?? {};
      const catId = payload.categoryId ?? 'unknown';
      const key = `${catId}:${payload.isOver ? 'over' : 'near'}`;
      existingKeys.add(key);
    }

    // 2) Calcular overview + crear nuevas alertas solo si no existen
    const budgets = await this.prisma.budget.findMany({
      where: {
        userId,
        ...(accountId ? { accountId } : {}),
      },
      include: {
        category: true,
        account: true,
      },
      orderBy: {
        category: {
          name: 'asc',
        },
      },
    });

    const items = await Promise.all(
      budgets.map(async (b) => {
        const { from, to } = this.getPeriodRange(b.startMonth, b.period);

        const agg = await this.prisma.transaction.aggregate({
          _sum: { valueCents: true },
          where: {
            account: {
              userId,
              ...(accountId ? { id: accountId } : {}),
            },
            categoryId: b.categoryId,
            type: TransactionType.debit,
            bookedAt: {
              gte: from,
              lt: to,
            },
          },
        });

        // Débitos vienen negativos → usamos valor absoluto
        const raw = agg._sum.valueCents ?? 0;
        const spentCents = raw < 0 ? -raw : raw;

        const amountCents = b.amountCents;
        const remainingCents = Math.max(0, amountCents - spentCents);
        const progress =
          amountCents > 0 ? Math.min(1, spentCents / amountCents) : 0;
        const isOver = spentCents >= amountCents;

        // --- alertas con antispam ---
        try {
          if (isOver) {
            const key = `${b.categoryId}:over`;
            if (!existingKeys.has(key)) {
              await this.alertsService.createBudgetAlert(userId, {
                categoryId: b.categoryId,
                categoryName: b.category.name,
                message: `Te pasaste del presupuesto en ${b.category.name}.`,
                isOver: true,
                period: b.period,
                startMonth: b.startMonth,
              });
              existingKeys.add(key);
            }
          } else if (progress >= 0.8) {
            const key = `${b.categoryId}:near`;
            if (!existingKeys.has(key)) {
              await this.alertsService.createBudgetAlert(userId, {
                categoryId: b.categoryId,
                categoryName: b.category.name,
                message: `Estás cerca de tu límite en ${b.category.name}.`,
                isOver: false,
                period: b.period,
                startMonth: b.startMonth,
              });
              existingKeys.add(key);
            }
          }
        } catch (e) {
          console.error('No se pudo crear alerta de presupuesto', e);
        }
        // ----------------------------

        return {
          id: b.id,
          category: {
            id: b.category.id,
            name: b.category.name,
            color: b.category.color,
          },
          amountCents,
          spentCents,
          remainingCents,
          progress,
          isOver,
          period: b.period,
          accountId: b.accountId,
        };
      }),
    );

    return items;
  }
}
