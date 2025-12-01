// api/scripts/export-ml-dataset.ts
import { PrismaClient, MlLabelSource } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Exportando dataset de transacciones para ML...');

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

  // Cabecera CSV
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
  ];

  const lines: string[] = [];
  lines.push(header.join(','));

  for (const tx of txs) {
    const row = {
      txId: tx.id,
      userId: tx.account.userId, // viene desde Account -> User
      accountType: tx.account.accountType,
      currency: tx.account.currency,
      valueCents: tx.valueCents,
      type: tx.type,
      isRecurring: tx.isRecurring,
      balanceAfterCents: tx.balanceAfterCents ?? '',
      bookedAt: tx.bookedAt.toISOString(),
      merchant: tx.merchant ?? '',
      description: tx.description ?? '',
      category: tx.category?.name ?? '',
    };

    // Escapar comas y comillas simples en texto
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
