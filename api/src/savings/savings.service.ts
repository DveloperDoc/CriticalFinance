// api/src/savings/savings.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TransactionType,
  AlertLevel,
  AlertSource,
  AlertType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsRuleDto } from './dto/create-savings-rule.dto';
import { UpdateSavingsRuleDto } from './dto/update-savings-rule.dto';

type SavingsMonth = {
  month: string; // "YYYY-MM"
  incomeCents: number;
  expenseCents: number;
  savingsCents: number; // income - expenses
  savingsRate: number | null; // savings / income (puede ser <0 si gastas más de lo que ingresas)
};

export type SavingsOverview = {
  months: SavingsMonth[];
  averageSavingsRate: number | null;
  averageSavingsCents: number;
};

@Injectable()
export class SavingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------- REGLAS DE AHORRO -----------------

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
      throw new BadRequestException(
        'La cuenta no existe o no pertenece al usuario',
      );
    }

    const rule = await this.prisma.savingsRule.create({
      data: {
        userId,
        accountId: account.id,
        thresholdCents: dto.thresholdCents,
        // si no viene, lo dejamos en 0 (sin margen)
        notifyMarginCents: dto.notifyMarginCents ?? 0,
      },
    });

    console.log('[SavingsService] rule created =', rule.id);

    return rule;
  }

  async listRules(userId: string) {
    const rules = await this.prisma.savingsRule.findMany({
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
        // última alerta activa asociada a la regla (si existe)
        alerts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rules.map((rule) => {
      const activeAlert = rule.alerts[0] ?? null;

      return {
        id: rule.id,
        thresholdCents: rule.thresholdCents,
        notifyMarginCents: rule.notifyMarginCents,
        createdAt: rule.createdAt,
        account: rule.account,
        hasActiveAlert: !!activeAlert,
        alertLevel: activeAlert?.level ?? null,      // 'INFO' | 'WARNING' | 'CRITICAL' | null
        alertMessage: activeAlert?.message ?? null,  // string | null
      };
    });
  }

  async updateRule(userId: string, id: string, dto: UpdateSavingsRuleDto) {
    const rule = await this.prisma.savingsRule.findUnique({ where: { id } });
    if (!rule || rule.userId !== userId) {
      throw new NotFoundException('Regla de ahorro no encontrada');
    }

    return this.prisma.savingsRule.update({
      where: { id },
      data: dto,
    });
  }

  async deleteRule(userId: string, id: string) {
    const rule = await this.prisma.savingsRule.findUnique({ where: { id } });
    if (!rule || rule.userId !== userId) {
      throw new NotFoundException('Regla de ahorro no encontrada');
    }

    await this.prisma.savingsRule.delete({ where: { id } });
    return { ok: true };
  }

  async listAlerts(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        account: true,
        savingsRule: true,
        transaction: true,
      },
    });
  }

  async listActiveAlerts(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        account: true,
        savingsRule: true,
        transaction: true,
      },
    });
  }

  async markAlertRead(userId: string, id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert || alert.userId !== userId) {
      throw new NotFoundException('Alerta no encontrada');
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        readAt: new Date(),
        isActive: false,
      },
    });
  }

  /**
   * Evalúa todas las reglas activas de un usuario contra el saldo actual
   * y crea/actualiza Alert en base a threshold + margin.
   */
  async evaluateRulesForUser(userId: string) {
    const rules = await this.prisma.savingsRule.findMany({
      where: { userId, active: true },
      include: {
        account: true,
      },
    });

    for (const rule of rules) {
      const saldoActual = rule.account.balanceCents;
      const umbral = rule.thresholdCents;
      const margin = rule.notifyMarginCents ?? 0;

      if (saldoActual <= umbral) {
        await this.createAlertIfNotExists(
          userId,
          rule.id,
          rule.accountId,
          saldoActual,
          umbral,
          margin,
          AlertLevel.CRITICAL,
        );
      } else if (saldoActual <= umbral + margin) {
        await this.createAlertIfNotExists(
          userId,
          rule.id,
          rule.accountId,
          saldoActual,
          umbral,
          margin,
          AlertLevel.WARNING,
        );
      } else {
        // saldo sano → desactivar alertas activas de esta regla
        await this.resolveActiveAlertsForRule(rule.id);
      }
    }

    return { ok: true };
  }

  private async createAlertIfNotExists(
    userId: string,
    savingsRuleId: string,
    accountId: string,
    saldoActual: number,
    thresholdCents: number,
    notifyMarginCents: number,
    level: AlertLevel,
  ) {
    // 1) Desactivar otras alertas activas de esta regla (de otro nivel)
    await this.prisma.alert.updateMany({
      where: {
        userId,
        savingsRuleId,
        type: AlertType.savings_rule_threshold,
        isActive: true,
        // desactivar cualquier otra CRITICAL/WARNING/INFO distinta del nivel actual
        level: { not: level },
      },
      data: {
        isActive: false,
        readAt: new Date(),
      },
    });

    // 2) Ver si ya existe una alerta activa de ESTE nivel
    const existing = await this.prisma.alert.findFirst({
      where: {
        userId,
        savingsRuleId,
        isActive: true,
        level,
        type: AlertType.savings_rule_threshold,
      },
    });

    // Si ya hay una alerta activa del mismo nivel, no crear otra
    if (existing) return existing;

    // 3) Crear la nueva alerta
    const message = this.buildAlertMessage(saldoActual, thresholdCents, level);

    return this.prisma.alert.create({
      data: {
        userId,
        accountId,
        savingsRuleId,
        type: AlertType.savings_rule_threshold,
        source: AlertSource.system,
        level,
        message,
        payload: {
          saldoActual,
          thresholdCents,
          notifyMarginCents,
        },
        isActive: true,
      },
    });
  }

  private buildAlertMessage(
    saldoActual: number,
    thresholdCents: number,
    level: AlertLevel,
  ): string {
    const saldo = (saldoActual / 100).toFixed(0);
    const umbral = (thresholdCents / 100).toFixed(0);

    if (level === AlertLevel.CRITICAL) {
      return `Tu saldo bajó del mínimo configurado (${umbral}) — saldo actual: ${saldo}`;
    }

    if (level === AlertLevel.WARNING) {
      return `Tu saldo está cerca del mínimo configurado (${umbral}) — saldo actual: ${saldo}`;
    }

    return `Alerta de saldo — mínimo: ${umbral}, saldo actual: ${saldo}`;
  }

  private async resolveActiveAlertsForRule(savingsRuleId: string) {
    await this.prisma.alert.updateMany({
      where: {
        savingsRuleId,
        isActive: true,
      },
      data: {
        isActive: false,
        readAt: new Date(),
      },
    });
  }

  // ----------------- OVERVIEW DE AHORRO -----------------

  private getMonthStart(year: number, monthIndex: number): Date {
    return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  }

  private getNextMonthStart(d: Date): Date {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
  }

  private formatMonth(d: Date): string {
    // "YYYY-MM"
    return d.toISOString().slice(0, 7);
  }

  // últimos N meses, incluyendo el actual
  private getLastMonthsRange(count: number): Date[] {
    const now = new Date();
    const currentStart = this.getMonthStart(
      now.getUTCFullYear(),
      now.getUTCMonth(),
    );

    const months: Date[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = this.getMonthStart(
        currentStart.getUTCFullYear(),
        currentStart.getUTCMonth() - i,
      );
      months.push(d);
    }
    return months;
  }

  // GET /savings/overview
  // accountId es opcional: si viene, se filtra por esa cuenta; si no, se agregan todas las cuentas del usuario.
  async getOverview(
    userId: string,
    accountId?: string,
  ): Promise<SavingsOverview> {
    const monthStarts = this.getLastMonthsRange(6);
    const months: SavingsMonth[] = [];

    for (const start of monthStarts) {
      const end = this.getNextMonthStart(start);

      // ingresos (credit, siempre en centavos positivos)
      const creditsAgg = await this.prisma.transaction.aggregate({
        _sum: { valueCents: true },
        where: {
          account: {
            userId,
            ...(accountId ? { id: accountId } : {}),
          },
          type: TransactionType.credit,
          bookedAt: {
            gte: start,
            lt: end,
          },
        },
      });

      // gastos (debit, en el modelo vienen negativos → tomo valor absoluto)
      const debitsAgg = await this.prisma.transaction.aggregate({
        _sum: { valueCents: true },
        where: {
          account: {
            userId,
            ...(accountId ? { id: accountId } : {}),
          },
          type: TransactionType.debit,
          bookedAt: {
            gte: start,
            lt: end,
          },
        },
      });

      const incomeRaw = creditsAgg._sum.valueCents ?? 0; // normalmente >= 0
      const expenseRaw = debitsAgg._sum.valueCents ?? 0; // normalmente <= 0

      const incomeCents = incomeRaw;
      const expenseCents = expenseRaw < 0 ? -expenseRaw : expenseRaw;

      const savingsCents = incomeCents - expenseCents;
      const savingsRate =
        incomeCents > 0 ? savingsCents / incomeCents : null;

      months.push({
        month: this.formatMonth(start),
        incomeCents,
        expenseCents,
        savingsCents,
        savingsRate,
      });
    }

    const rates = months
      .map((m) => m.savingsRate)
      .filter((r): r is number => r !== null);

    const averageSavingsRate =
      rates.length > 0
        ? rates.reduce((acc, r) => acc + r, 0) / rates.length
        : null;

    const averageSavingsCents =
      months.reduce((acc, m) => acc + m.savingsCents, 0) /
      (months.length || 1);

    return {
      months,
      averageSavingsRate,
      averageSavingsCents: Math.round(averageSavingsCents),
    };
  }
}
