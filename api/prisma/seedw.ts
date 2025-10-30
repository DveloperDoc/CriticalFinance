const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.category.createMany({
    data: [
      { name: 'Alimentación', color: '#FF6347' },
      { name: 'Transporte',  color: '#1E90FF' },
      { name: 'Salud',       color: '#2ECC71' },
    ],
    skipDuplicates: true,
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@bank.cl' },
    update: {},
    create: { name: 'Usuario Demo', email: 'demo@bank.cl', passwordHash: 'x' },
  });

  const account = await prisma.account.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: user.id,
      currency: 'CLP',
      balanceCents: 0,
    },
  });

  const [alimen, transp] = await Promise.all([
    prisma.category.findUnique({ where: { name: 'Alimentación' } }),
    prisma.category.findUnique({ where: { name: 'Transporte' } }),
  ]);

  await prisma.transaction.createMany({
    data: [
      {
        id: 't1',
        accountId: account.id,
        categoryId: alimen?.id ?? null,
        bookedAt: new Date().toISOString(),
        valueCents: -25990,
        type: 'debit',
        merchant: 'LIDER TEMUCO POS 1234',
        description: 'Compra supermercado',
        isRecurring: false,
      },
      {
        id: 't2',
        accountId: account.id,
        categoryId: transp?.id ?? null,
        bookedAt: new Date().toISOString(),
        valueCents: -1500,
        type: 'debit',
        merchant: 'RED METRO SANTIAGO',
        description: 'Recarga bip!',
        isRecurring: false,
      },
      {
        id: 't3',
        accountId: account.id,
        categoryId: null,
        bookedAt: new Date().toISOString(),
        valueCents: 50000,
        type: 'credit',
        merchant: 'EMPRESA XYZ',
        description: 'Depósito nómina',
        isRecurring: false,
      },
    ],
    skipDuplicates: true,
  });

  const sum = await prisma.transaction.aggregate({
    _sum: { valueCents: true },
    where: { accountId: account.id },
  });

  await prisma.account.update({
    where: { id: account.id },
    data: { balanceCents: sum._sum.valueCents ?? 0 },
  });

  console.log('✅ Seed OK');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });