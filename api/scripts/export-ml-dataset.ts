// api/scripts/export-ml-dataset.ts
import { PrismaClient, MlLabelSource } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Exportando dataset de transacciones para ML...');

  // 1) Cargar categorías (id, parentId, name) para poder resolver la macro
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      parentId: true,
      name: true,
    },
  });

  const catMap = new Map<
    string,
    { id: string; parentId: string | null; name: string }
  >();
  for (const c of categories) {
    catMap.set(c.id, {
      id: c.id,
      parentId: c.parentId ?? null,
      name: c.name,
    });
  }

  const getRootCategory = (catId: string | null | undefined):
    | { id: string; name: string }
    | null => {
    if (!catId) return null;
    let current = catMap.get(catId);
    if (!current) return null;

    while (current.parentId) {
      const parent = catMap.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return { id: current.id, name: current.name };
  };

  const txs = await prisma.transaction.findMany({
    where: {
      categoryId: { not: null },
      OR: [
        { mlLabelSource: null },
        { mlLabelSource: MlLabelSource.manual },
        { mlLabelSource: MlLabelSource.imported },
      ],
    },
    include: {
      category: true,
      account: true,
    },
  });

  console.log(`Filas encontradas: ${txs.length}`);

  const outPath = path.join(__dirname, '../../ml/data/transactions_train.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const header = [
    'txId',
    'userId',
    'accountType',
    'currency',
    'valueCents',
    'type',
    'isRecurring',
    'balanceAfterCents',
    'bookedAt',
    'merchant',
    'description',
    'category',
    'categoryMacro', // NUEVO
  ];

  const lines: string[] = [];
  lines.push(header.join(','));

  for (const tx of txs) {
    const root = getRootCategory(tx.categoryId);
    const categoryName = tx.category?.name ?? '';
    const categoryMacroName = root?.name ?? categoryName;

    const row = {
      txId: tx.id,
      userId: tx.account.userId,
      accountType: tx.account.accountType,
      currency: tx.account.currency,
      valueCents: tx.valueCents,
      type: tx.type,
      isRecurring: tx.isRecurring,
      balanceAfterCents: tx.balanceAfterCents ?? '',
      bookedAt: tx.bookedAt.toISOString(),
      merchant: tx.merchant ?? '',
      description: tx.description ?? '',
      category: categoryName,
      categoryMacro: categoryMacroName,
    };

    const serialized = [
      row.txId,
      row.userId,
      row.accountType,
      row.currency,
      row.valueCents,
      row.type,
      row.isRecurring,
      row.balanceAfterCents,
      row.bookedAt,
      escapeCsv(row.merchant),
      escapeCsv(row.description),
      escapeCsv(row.category),
      escapeCsv(row.categoryMacro),
    ];

    lines.push(serialized.join(','));
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Dataset guardado en: ${outPath}`);

  await prisma.$disconnect();
}

function escapeCsv(value: string | number | boolean | ''): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

main().catch((e) => {
  console.error(e);
  return prisma.$disconnect().finally(() => process.exit(1));
});
