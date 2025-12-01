import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { MlService } from '../ml/ml.service';
import { MlLabelSource, TransactionType } from '@prisma/client';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlService: MlService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    // 1) validar que la cuenta pertenece al usuario y traer accountType/currency
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
      select: { id: true, accountType: true, currency: true },
    });

    if (!account) {
      throw new ForbiddenException('Account not found or not owned by user');
    }

    let mlPredictedCategoryId: string | null = null;
    let mlLabelSource: MlLabelSource | null = null;
    let mlModelVersion: string | null = null;

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
      }
    }

    // 3) Crear la transacción en BD
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
      },
      include: {
        category: true,
        mlPredictedCategory: true,
      },
    });

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

  // NUEVO: confirmar/cambiar categoría de una transacción
  async updateCategory(
    userId: string,
    id: string,
    dto: UpdateTransactionCategoryDto,
  ) {
    // 1) verificar que la transacción pertenece al usuario
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id,
        account: { userId },
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    // 2) verificar que la categoría pertenece al usuario
    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        userId,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // 3) actualizar: set categoryId y marcar mlLabelSource como manual
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

  // RESUMEN ML: cuántos movimientos hay, cuántos usan IA, etc.
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

  // NUEVO: detectar movimientos inusuales usando anomalyScore (y fallback z-score simple)
async getAnomalies(userId: string) {
  const now = new Date();
  const since = new Date(now.getTime());
  since.setDate(since.getDate() - 90); // últimos 90 días

  const txs = await this.prisma.transaction.findMany({
    where: {
      account: { userId },
      type: TransactionType.debit,
      bookedAt: { gte: since },
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
    // consideramos anomalía si anomalyScore >= 0.8 (o lo que quieras)
    const anomalies = withScore.filter((tx) => (tx.anomalyScore as number) >= 0.8);

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
    }));
  }

  // 2) Fallback: si no hay anomalyScore, hacemos z-score simple por categoría
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
  }));
}
}
