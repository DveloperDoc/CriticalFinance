import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { MlService } from '../ml/ml.service';
import {
  MlLabelSource,
  TransactionType,
  AlertLevel,
} from '@prisma/client';
import { SavingsRuleEvaluatorService } from '../savings/savings-rule-evaluator.service';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto';
import { AlertsService } from '../alerts/alerts.service';
import { GastosHormigaFilterDto } from './dto/gastos-hormiga-filter.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlService: MlService,
    private readonly savingsRuleEvaluator: SavingsRuleEvaluatorService,
    private readonly alertsService: AlertsService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    // 1) validar que la cuenta pertenece al usuario y traer datos relevantes
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
      select: {
        id: true,
        accountType: true,
        currency: true,
        balanceCents: true,
      },
    });

    if (!account) {
      throw new ForbiddenException('Account not found or not owned by user');
    }

    let mlPredictedCategoryId: string | null = null;
    let mlLabelSource: MlLabelSource | null = null;
    let mlModelVersion: string | null = null;
    let anomalyScore: number | null = null;
    let isGastoHormiga = false;

    // 2) Si el cliente NO manda categoryId, intentamos predecir con ML
    if (!dto.categoryId) {
      const mlResult = await this.mlService.predictCategory({
        description: dto.description,
        merchant: dto.merchant,
        valueCents: dto.valueCents,
        bookedAt: dto.bookedAt,
        accountType: account.accountType,
        currency: account.currency,
        type: dto.type as unknown as string, // TransactionType → string
        isRecurring: false,
        balanceAfterCents: null,
      });

      if (mlResult) {
        // Buscar Category por NOMBRE para ese usuario
        const matchedCategory = await this.prisma.category.findFirst({
          where: {
            userId,
            name: mlResult.category,
          },
        });

        if (matchedCategory) {
          mlPredictedCategoryId = matchedCategory.id;
          mlLabelSource = MlLabelSource.model;
          mlModelVersion = process.env.ML_MODEL_VERSION ?? 'tx-clf-v1';
        }

        // flag de gasto hormiga desde el modelo (campo extra no tipado)
        isGastoHormiga = Boolean((mlResult as any).isGastoHormiga);
      }
    }

    // 3) Calcular anomalyScore simple (solo para débitos)
    if (dto.type === TransactionType.debit) {
      const prevBalance = account.balanceCents ?? 0;
      const absVal = Math.abs(dto.valueCents);

      if (prevBalance > 0 && absVal > 0) {
        const ratio = absVal / prevBalance; // 0.5 = 50% del saldo
        anomalyScore = Math.min(1, ratio); // clamp 0..1
      } else if (absVal >= 200_000) {
        // gasto grande sin saldo previo conocido
        anomalyScore = 0.9;
      }
    }

    // 4) Crear la transacción en BD
    const tx = await this.prisma.transaction.create({
      data: {
        accountId: dto.accountId,
        valueCents: dto.valueCents,
        type: dto.type,
        bookedAt: new Date(dto.bookedAt),
        postedAt: dto.postedAt ? new Date(dto.postedAt) : null,
        merchant: dto.merchant ?? null,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        externalId: dto.externalId ?? null,

        mlPredictedCategoryId,
        mlLabelSource,
        mlModelVersion,

        anomalyScore,

        // flag de gasto hormiga
        isGastoHormiga,

        // opcional: features internas para ML
        features: dto.features ?? null,
      },
      include: {
        category: true,
        mlPredictedCategory: true,
      },
    });

    // 5) Actualizar saldo de la cuenta según el tipo de transacción
    const signedDelta =
      dto.type === TransactionType.credit
        ? Math.abs(dto.valueCents)
        : -Math.abs(dto.valueCents);

    try {
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          balanceCents: {
            increment: signedDelta,
          },
        },
      });
    } catch (e) {
      // no rompemos la creación de la tx si falla el update de saldo
      // eslint-disable-next-line no-console
      console.warn(
        '[TransactionsService] Error actualizando balance de cuenta',
        e,
      );
    }

    // 6) Re-evaluar reglas de ahorro para el usuario
    try {
      await this.savingsRuleEvaluator.evaluateAllForUser(userId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[TransactionsService] Error evaluando reglas de ahorro',
        e,
      );
    }

    // 7) Crear alerta de anomalía si el score es alto (movimiento MUY grande)
    try {
      if (anomalyScore !== null && anomalyScore >= 0.6) {
        let level: AlertLevel = AlertLevel.WARNING;
        if (anomalyScore >= 0.85) {
          level = AlertLevel.CRITICAL;
        }

        const msg =
          level === AlertLevel.CRITICAL
            ? 'El sistema detectó un gasto inusual y muy alto en tu cuenta.'
            : 'El sistema detectó un gasto inusual en tu cuenta.';

        await this.alertsService.createAnomalyAlert(userId, {
          transactionId: tx.id,
          level,
          message: msg,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[TransactionsService] Error creando alerta de anomalía',
        e,
      );
    }

    // 8) Crear alerta de GASTO HORMIGA si corresponde
    try {
      if (isGastoHormiga) {
        await this.alertsService.createGastoHormigaAlert(userId, {
          transactionId: tx.id,
          amountCents: Math.abs(dto.valueCents),
          description: dto.description ?? null,
          merchant: dto.merchant ?? null,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[TransactionsService] Error creando alerta de gasto hormiga',
        e,
      );
    }

    return tx;
  }

  async findAll(userId: string, filter: FilterTransactionsDto) {
    const { accountId, from, to, categoryId } = filter;

    return this.prisma.transaction.findMany({
      where: {
        account: {
          userId,
        },
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        bookedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        category: true,
        mlPredictedCategory: true,
      },
      orderBy: { bookedAt: 'desc' },
      take: 200,
    });
  }

  async findOne(userId: string, id: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id,
        account: { userId },
      },
      include: {
        category: true,
        mlPredictedCategory: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    return tx;
  }

  // confirmar/cambiar categoría de una transacción
  async updateCategory(
    userId: string,
    id: string,
    dto: UpdateTransactionCategoryDto,
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id,
        account: { userId },
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        userId,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        categoryId: category.id,
        mlLabelSource: MlLabelSource.manual,
      },
      include: {
        category: true,
        mlPredictedCategory: true,
      },
    });

    return updated;
  }

  // RESUMEN ML
  async getMlSummary(userId: string) {
    const whereBase = {
      account: { userId },
    };

    const [total, withCategory, withSuggestion, pendingIa, confirmedManual] =
      await Promise.all([
        this.prisma.transaction.count({
          where: whereBase,
        }),
        this.prisma.transaction.count({
          where: {
            ...whereBase,
            categoryId: { not: null },
          },
        }),
        this.prisma.transaction.count({
          where: {
            ...whereBase,
            mlPredictedCategoryId: { not: null },
          },
        }),
        this.prisma.transaction.count({
          where: {
            ...whereBase,
            categoryId: null,
            mlPredictedCategoryId: { not: null },
            mlLabelSource: 'model',
          },
        }),
        this.prisma.transaction.count({
          where: {
            ...whereBase,
            categoryId: { not: null },
            mlLabelSource: 'manual',
          },
        }),
      ]);

    return {
      total,
      withCategory,
      withSuggestion,
      pendingIa,
      confirmedManual,
      noCategory: total - withCategory,
    };
  }

  // movimientos inusuales / anomalías (solo NO resueltas)
  async getAnomalies(userId: string) {
    const now = new Date();
    const since = new Date(now.getTime());
    since.setDate(since.getDate() - 90); // últimos 90 días

    const txs = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        type: TransactionType.debit,
        bookedAt: { gte: since },
        anomalyResolved: false, // solo anomalías pendientes
      },
      include: {
        category: true,
      },
      orderBy: { bookedAt: 'desc' },
    });

    if (!txs.length) return [];

    // 1) Caso simple: usar anomalyScore si ya viene relleno
    const withScore = txs.filter(
      (tx) => tx.anomalyScore !== null && tx.anomalyScore !== undefined,
    );

    if (withScore.length > 0) {
      // consideramos anomalía si anomalyScore >= 0.8
      const anomalies = withScore.filter(
        (tx) => (tx.anomalyScore as number) >= 0.8,
      );

      return anomalies.map((tx) => ({
        id: tx.id,
        merchant: tx.merchant,
        description: tx.description,
        valueCents: tx.valueCents,
        absValueCents: Math.abs(tx.valueCents),
        bookedAt: tx.bookedAt,
        category: tx.category
          ? {
              id: tx.category.id,
              name: tx.category.name,
              color: tx.category.color,
            }
          : null,
        anomalyScore: tx.anomalyScore,
        anomalyResolved: tx.anomalyResolved,
      }));
    }

    // 2) Fallback: z-score simple por categoría
    const byCat = new Map<string, number[]>();
    for (const tx of txs) {
      const key = tx.categoryId ?? 'uncategorized';
      const absVal = Math.abs(tx.valueCents);
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(absVal);
    }

    const stats = new Map<string, { mean: number; std: number }>();
    for (const [key, vals] of byCat) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      let variance = 0;
      if (vals.length > 1) {
        variance =
          vals.reduce((a, v) => a + Math.pow(v - mean, 2), 0) /
          (vals.length - 1);
      }
      const std = Math.sqrt(variance);
      stats.set(key, { mean, std });
    }

    const anomalies = txs
      .map((tx) => {
        const key = tx.categoryId ?? 'uncategorized';
        const { mean, std } = stats.get(key)!;
        const absVal = Math.abs(tx.valueCents);
        let z = 0;
        if (std > 0) z = (absVal - mean) / std;
        const score = Number(z.toFixed(2));

        return { tx, absVal, score };
      })
      .filter((item) => item.score >= 2 && item.absVal > 0);

    return anomalies.map(({ tx, score }) => ({
      id: tx.id,
      merchant: tx.merchant,
      description: tx.description,
      valueCents: tx.valueCents,
      absValueCents: Math.abs(tx.valueCents),
      bookedAt: tx.bookedAt,
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            color: tx.category.color,
          }
        : null,
      anomalyScore: score,
      anomalyResolved: tx.anomalyResolved,
    }));
  }

  // marcar / desmarcar anomalía como resuelta
  async setAnomalyResolved(
    userId: string,
    id: string,
    resolved: boolean,
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id,
        account: { userId },
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        anomalyResolved: resolved,
      },
    });
  }

  // LISTA DE GASTOS HORMIGA
  async getGastosHormiga(userId: string, filter: GastosHormigaFilterDto) {
    const { accountId, from, to } = filter;

    const txs = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        isGastoHormiga: true,
        accountId: accountId || undefined,
        bookedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        category: true,
      },
      orderBy: { bookedAt: 'desc' },
    });

    return txs.map((tx) => ({
      id: tx.id,
      merchant: tx.merchant,
      description: tx.description,
      valueCents: tx.valueCents,
      absValueCents: Math.abs(tx.valueCents),
      bookedAt: tx.bookedAt,
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            color: tx.category.color,
          }
        : null,
      isGastoHormiga: tx.isGastoHormiga,
    }));
  }

  // RESUMEN DE GASTOS HORMIGA (total y por categoría)
  async getGastosHormigaSummary(
    userId: string,
    filter: GastosHormigaFilterDto,
  ) {
    const { accountId, from, to } = filter;

    const txs = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        isGastoHormiga: true,
        accountId: accountId || undefined,
        bookedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        category: true,
      },
    });

    if (!txs.length) {
      return {
        totalCount: 0,
        totalAmountCents: 0,
        byCategory: [],
      };
    }

    const totalCount = txs.length;
    const totalAmountCents = txs.reduce(
      (sum, tx) => sum + Math.abs(tx.valueCents),
      0,
    );

    type CatAgg = {
      categoryId: string | null;
      name: string;
      color: string | null;
      count: number;
      totalAmountCents: number;
    };

    const byCategoryMap = new Map<string, CatAgg>();

    for (const tx of txs) {
      const key = tx.categoryId ?? 'uncategorized';
      const absVal = Math.abs(tx.valueCents);

      let agg = byCategoryMap.get(key);
      if (!agg) {
        agg = {
          categoryId: tx.categoryId ?? null,
          name: tx.category?.name ?? 'Sin categoría',
          color: tx.category?.color ?? null,
          count: 0,
          totalAmountCents: 0,
        };
        byCategoryMap.set(key, agg);
      }

      agg.count += 1;
      agg.totalAmountCents += absVal;
    }

    const byCategory = Array.from(byCategoryMap.values()).sort(
      (a, b) => b.totalAmountCents - a.totalAmountCents,
    );

    return {
      totalCount,
      totalAmountCents,
      byCategory,
    };
  }
}
