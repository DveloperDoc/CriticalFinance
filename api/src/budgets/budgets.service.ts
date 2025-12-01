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
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
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
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
  }

  // Rango [from, to) según el tipo de periodo
  private getPeriodRange(start: Date, period: BudgetPeriod): { from: Date; to: Date } {
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

  // POST /budgets  → upsert por (userId, categoryId, period)
  async upsert(userId: string, dto: UpsertBudgetDto) {
    if (!userId) {
      throw new BadRequestException('userId no definido al guardar presupuesto.');
    }

    const startMonth = this.getCurrentMonthStart();

    try {
      return await this.prisma.budget.upsert({
        where: {
          userId_categoryId_period: {
            userId,
            categoryId: dto.categoryId,
            period: dto.period,
          },
        },
        create: {
          userId,
          categoryId: dto.categoryId,
          amountCents: dto.amountCents,
          period: dto.period,
          startMonth,
        },
        update: {
          amountCents: dto.amountCents,
          startMonth,
        },
      });
    } catch (e: any) {
      console.error('Error Prisma al upsert budget', e);

      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2003') {
          throw new BadRequestException('Categoría inválida para este presupuesto.');
        }
        if (e.code === 'P2002') {
          throw new BadRequestException(
            'Ya existe un presupuesto para esa categoría y período.',
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

  // GET /budgets/overview
  async getOverview(userId: string) {
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
    for (const a of existingBudgetAlerts as any[]) {
      const payload = a.payload ?? {};
      const catId = payload.categoryId ?? 'unknown';
      const key = `${catId}:${payload.isOver ? 'over' : 'near'}`;
      existingKeys.add(key);
    }

    // 2) Calcular overview + crear nuevas alertas solo si no existen
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: {
        category: true,
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
            account: { userId },
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

        // --- NUEVO: generación de alertas con antispam en memoria ---
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
        // ------------------------------------------------------------

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
        };
      }),
    );

    return items;
  }
}
