// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Usuario
  const user = await prisma.user.create({
    data: {
      name: 'Kevin Farias',
      email: 'kevin@example.com',
      passwordHash: 'hashedpassword123', // luego se reemplaza con argon2
    },
  });

  // 2. Cuenta
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      balanceCents: 150000, // $1500 CLP
      currency: 'CLP',
    },
  });

  // 3. Categorías
  const categories = await prisma.category.createMany({
    data: [
      { name: 'Alimentación', color: '#FF6347' },
      { name: 'Transporte', color: '#1E90FF' },
      { name: 'Entretenimiento', color: '#FFD700' },
      { name: 'Servicios Básicos', color: '#32CD32' },
    ],
    skipDuplicates: true,
  });

  // obtener IDs de categorías
  const alimentacion = await prisma.category.findUnique({ where: { name: 'Alimentación' } });
  const transporte = await prisma.category.findUnique({ where: { name: 'Transporte' } });

  // 4. Transacciones
  await prisma.transaction.createMany({
    data: [
      {
        accountId: account.id,
        categoryId: alimentacion?.id,
        bookedAt: new Date(),
        valueCents: -25990,
        type: 'debit',
        merchant: 'LIDER TEMUCO POS 1234',
        description: 'Compra supermercado',
      },
      {
        accountId: account.id,
        categoryId: transporte?.id,
        bookedAt: new Date(),
        valueCents: -1500,
        type: 'debit',
        merchant: 'RED METRO SANTIAGO',
        description: 'Recarga bip!',
      },
      {
        accountId: account.id,
        bookedAt: new Date(),
        valueCents: 50000,
        type: 'credit',
        merchant: 'EMPRESA XYZ',
        description: 'Depósito nómina',
      },
    ],
  });

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });