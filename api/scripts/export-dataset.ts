// scripts/export-dataset.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("Exportando dataset...");

  const txs = await prisma.transaction.findMany({
    where: {
      categoryId: { not: null },     // solo transacciones con categoría
    },
    include: { category: true },      // traemos la Category asociada
    orderBy: { bookedAt: "asc" },
  });

  // Asegurar carpeta de salida
  const outDir = path.join(process.cwd(), "ml/dataset");
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, "synthetic_dataset.csv");

  // Cabecera CSV
  let csv = "date,description,amount_clp,category,merchant\n";

  for (const tx of txs) {
    const date = tx.bookedAt.toISOString();

    // escapamos comillas dobles en descripción para no romper el CSV
    const description = (tx.description ?? "").replace(/"/g, "'");
    const amount = tx.valueCents / 100;

    // solo usamos name, porque tu Category no tiene field `code`
    const categoryName = tx.category?.name ?? "";

    const merchant = tx.merchant ?? "";

    csv += `${date},"${description}",${amount},"${categoryName}","${merchant}"\n`;
  }

  fs.writeFileSync(outFile, csv);
  console.log("Dataset exportado en:", outFile);
}

main()
  .catch((e) => {
    console.error("Error exportando dataset:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
