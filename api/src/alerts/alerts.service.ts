// api/src/alerts/alerts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AlertSource,
  AlertType,
  BudgetPeriod,
  AlertLevel,
} from '@prisma/client';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  // Listar alertas del usuario, más recientes primero
  async listForUser(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // Solo alertas activas (para el centro de alertas)
  async listActiveForUser(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // Método genérico: actualizar estado de lectura (read / unread)
  async updateRead(userId: string, alertId: string, read: boolean) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new NotFoundException('Alerta no encontrada');
    }

    return this.prisma.alert.update({
      where: { id: alertId },
      data: {
        readAt: read ? new Date() : null,
        isActive: !read,
      },
    });
  }

  // Compat: marcar alerta como leída (true) usando el método genérico
  async markAsRead(userId: string, alertId: string) {
    return this.updateRead(userId, alertId, true);
  }

  // Eliminar alerta (usado al deslizar para limpiar de la lista)
  async remove(userId: string, alertId: string) {
    const deleted = await this.prisma.alert.deleteMany({
      where: { id: alertId, userId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(
        'Alerta no encontrada o no pertenece al usuario',
      );
    }

    return { ok: true };
  }

  // Crear alerta asociada a un presupuesto (solo creación; preferir upsertBudgetAlert para lógica completa)
  async createBudgetAlert(
    userId: string,
    params: {
      categoryId: string;
      categoryName: string;
      message: string;
      isOver: boolean;
      period: BudgetPeriod;
      startMonth: Date;
    },
  ) {
    return this.prisma.alert.create({
      data: {
        userId,
        type: AlertType.budget_over,
        source: AlertSource.system,
        transactionId: null,
        accountId: null,
        savingsRuleId: null,
        level: params.isOver ? AlertLevel.CRITICAL : AlertLevel.WARNING,
        message: params.message,
        payload: {
          categoryId: params.categoryId,
          categoryName: params.categoryName,
          isOver: params.isOver,
          period: params.period,
          startMonth: params.startMonth,
        },
      },
    });
  }

  // Crear / actualizar / resolver alerta de presupuesto
  async upsertBudgetAlert(
    userId: string,
    params: {
      accountId: string;
      categoryId: string;
      categoryName: string;
      progress: number; // 0..1
      isOver: boolean;
    },
  ) {
    const { accountId, categoryId, categoryName, progress, isOver } = params;

    // Si está sano (< 0.8) y no está pasado → resolver alerta existente
    if (progress < 0.8 && !isOver) {
      await this.prisma.alert.updateMany({
        where: {
          userId,
          accountId,
          type: AlertType.budget_over,
          payload: {
            path: ['categoryId'],
            equals: categoryId,
          },
          isActive: true,
        },
        data: {
          isActive: false,
          readAt: new Date(),
        },
      });

      return;
    }

    // Determinar nivel
    const level = isOver ? AlertLevel.CRITICAL : AlertLevel.WARNING;

    const message = isOver
      ? `La categoría "${categoryName}" ya superó su presupuesto mensual.`
      : `La categoría "${categoryName}" está cerca de su límite de presupuesto.`;

    const payload = {
      categoryId,
      categoryName,
      isOver,
      progress,
    };

    // Buscar alerta existente activa para esa categoría + cuenta
    const existing = await this.prisma.alert.findFirst({
      where: {
        userId,
        accountId,
        type: AlertType.budget_over,
        payload: {
          path: ['categoryId'],
          equals: categoryId,
        },
        isActive: true,
      },
    });

    if (!existing) {
      // Crear alerta nueva
      return this.prisma.alert.create({
        data: {
          userId,
          accountId,
          type: AlertType.budget_over,
          source: AlertSource.system,
          level,
          message,
          payload,
        },
      });
    }

    // Actualizar alerta existente
    return this.prisma.alert.update({
      where: { id: existing.id },
      data: {
        level,
        message,
        payload,
        isActive: true,
      },
    });
  }

  // Marcar como resueltas las alertas de anomalía ligadas a una transacción
  async resolveAnomalyAlerts(userId: string, transactionId: string) {
    await this.prisma.alert.updateMany({
      where: {
        userId,
        transactionId,
        type: AlertType.anomaly,
        isActive: true,
      },
      data: {
        isActive: false,
        readAt: new Date(),
      },
    });
  }

  // Alerta por movimiento inusual (anomalía general)
  async createAnomalyAlert(
    userId: string,
    params: {
      transactionId: string;
      message?: string;
      level?: AlertLevel;
    },
  ) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: params.transactionId },
      select: { accountId: true, bookedAt: true },
    });

    return this.prisma.alert.create({
      data: {
        userId,
        type: AlertType.anomaly,
        source: AlertSource.ml,
        level: params.level ?? AlertLevel.WARNING,
        transactionId: params.transactionId,
        accountId: tx?.accountId ?? null,
        savingsRuleId: null,
        message:
          params.message ??
          'Detectamos un movimiento inusual en tu cuenta.',
        payload: {
          kind: 'anomaly',
          transactionId: params.transactionId,
          bookedAt: tx?.bookedAt ?? null,
          message: params.message,
        },
      },
    });
  }

  // Alerta específica para "gasto hormiga"
  async createGastoHormigaAlert(
    userId: string,
    params: {
      transactionId: string;
      amountCents: number;
      description?: string | null;
      merchant?: string | null;
    },
  ) {
    const { transactionId, amountCents, description, merchant } = params;

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { accountId: true, bookedAt: true },
    });

    const label =
      (description && description.trim().length > 0 && description) ||
      (merchant && merchant.trim().length > 0 && merchant) ||
      'un movimiento pequeño';

    const prettyAmount = amountCents / 100;

    const message = `Detectamos un posible gasto hormiga: ${label} por $${prettyAmount.toFixed(
      0,
    )}.`;

    return this.prisma.alert.create({
      data: {
        userId,
        type: AlertType.anomaly, // diferenciamos por payload.kind
        source: AlertSource.ml,
        level: AlertLevel.WARNING,
        transactionId,
        accountId: tx?.accountId ?? null,
        savingsRuleId: null,
        message,
        payload: {
          kind: 'gasto_hormiga',
          transactionId,
          amountCents,
          bookedAt: tx?.bookedAt ?? null,
          description: description ?? null,
          merchant: merchant ?? null,
        },
      },
    });
  }
}
