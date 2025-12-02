// api/src/savings/savings-rule-evaluator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertSource, AlertType, AlertLevel } from '@prisma/client';

@Injectable()
export class SavingsRuleEvaluatorService {
  private readonly logger = new Logger(SavingsRuleEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evalúa todas las reglas de ahorro de un usuario.
   */
  async evaluateAllForUser(userId: string) {
    this.logger.log(`Evaluando reglas de ahorro para userId=${userId}`);

    const rules = await this.prisma.savingsRule.findMany({
      where: { userId, active: true },
      include: {
        account: true,
        alerts: {
          where: { isActive: true },
        },
      },
    });

    for (const rule of rules) {
      const account = rule.account;
      const balance = account.balanceCents;
      const threshold = rule.thresholdCents;
      const margin = rule.notifyMarginCents ?? 0;
      const warnThreshold = threshold + margin;

      let level: AlertLevel | null = null;
      let message: string | null = null;

      if (balance <= threshold) {
        level = AlertLevel.CRITICAL;
        message =
          'El saldo de esta cuenta está por debajo del saldo mínimo configurado.';
      } else if (margin > 0 && balance <= warnThreshold) {
        level = AlertLevel.WARNING;
        message =
          'El saldo de esta cuenta se está acercando al saldo mínimo configurado.';
      } else {
        level = null;
      }

      const activeAlert = rule.alerts[0] ?? null;

      // Si pasa a estado OK y había alerta activa -> la desactivamos
      if (!level) {
        if (activeAlert) {
          await this.prisma.alert.update({
            where: { id: activeAlert.id },
            data: {
              isActive: false,
            },
          });
        }
        continue;
      }

      // Payload para el front / trazabilidad
      const payload = {
        accountId: account.id,
        accountAlias: account.alias,
        bank: account.bank,
        accountNumber: account.accountNumber,
        currency: account.currency,
        balanceCents: balance,
        thresholdCents: threshold,
        notifyMarginCents: rule.notifyMarginCents,
      };

      if (activeAlert) {
        // Actualizar alerta existente
        await this.prisma.alert.update({
          where: { id: activeAlert.id },
          data: {
            type: AlertType.savings_rule_threshold,
            source: AlertSource.system,
            accountId: account.id,
            savingsRuleId: rule.id,
            level,
            message,
            payload,
            isActive: true,
          },
        });
      } else {
        // Crear nueva alerta
        await this.prisma.alert.create({
          data: {
            userId: rule.userId,
            accountId: account.id,
            savingsRuleId: rule.id,
            type: AlertType.savings_rule_threshold,
            source: AlertSource.system,
            level,
            message,
            payload,
            isActive: true,
          },
        });
      }
    }

    this.logger.log(`Finalizada evaluación de reglas para userId=${userId}`);
  }

  /**
   * Evalúa todas las reglas de todos los usuarios.
   * Útil si más adelante lo montas en un cron global.
   */
  async evaluateAllUsers() {
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    for (const u of users) {
      await this.evaluateAllForUser(u.id);
    }
  }
}
