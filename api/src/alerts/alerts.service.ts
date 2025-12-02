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

  // Crear alerta asociada a un presupuesto
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

  // NUEVO: alerta por movimiento inusual (anomalía)
  async createAnomalyAlert(
    userId: string,
    params: {
      transactionId: string;
      message?: string;
      level?: AlertLevel;
    },
  ) {
    return this.prisma.alert.create({
      data: {
        userId,
        type: AlertType.anomaly,
        source: AlertSource.ml,
        level: params.level ?? AlertLevel.WARNING,
        transactionId: params.transactionId,
        accountId: null,
        savingsRuleId: null,
        message:
          params.message ??
          'Detectamos un movimiento inusual en tu cuenta.',
        payload: {
          transactionId: params.transactionId,
          message: params.message,
        },
      },
    });
  }
}
