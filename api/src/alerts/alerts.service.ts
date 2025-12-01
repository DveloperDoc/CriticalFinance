// api/src/alerts/alerts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertSource, AlertType, BudgetPeriod } from '@prisma/client';

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

  // Marcar alerta como leída
  async markAsRead(userId: string, alertId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new NotFoundException('Alerta no encontrada');
    }

    return this.prisma.alert.update({
      where: { id: alertId },
      data: { readAt: new Date() },
    });
  }

  // Crear alerta asociada a un presupuesto (simple, sin deduplicar aún)
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
        payload: {
          categoryId: params.categoryId,
          categoryName: params.categoryName,
          message: params.message,
          isOver: params.isOver,
          period: params.period,
          startMonth: params.startMonth,
        },
      },
    });
  }
}
