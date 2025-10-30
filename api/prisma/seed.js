/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');
const { subMonths, eachDayOfInterval } = require('date-fns');

const prisma = new PrismaClient();

// Config rápida
const CONFIG = {
  USERS: 1,               // cuántos usuarios demo
  ACCOUNTS_PER_USER: 1,   // cuentas por usuario
  MONTHS_BACK: 6,         // meses hacia atrás para generar transacciones
  AVG_TX_PER_DAY: 2.2,    // promedio transacciones por día
  CREDIT_INCOME_CLP: [450000, 900000], // rango ingresos mensuales
};

// Catálogo mínimo de categorías (puedes ampliarlo)
const CATS = [
  { name: 'Alimentación', color: '#FF6347', merchants: ['LIDER', 'JUMBO', 'TOTTUS', 'UNIMARC', 'SANTA ISABEL', 'DONDE PEPE', 'MINIMARKET'] },
  { name: 'Transporte',  color: '#1E90FF', merchants: ['RED METRO', 'UBER', 'DIDI', 'CABIFY', 'COPEC', 'SHELL', 'PETROBRAS'] },
  { name: 'Entretenimiento', color: '#9B59B6', merchants: ['NETFLIX', 'SPOTIFY', 'STEAM', 'CINEMARK', 'CINEHOYTS'] },
  { name: 'Salud', color: '#2ECC71', merchants: ['CRUZ VERDE', 'SALCOBRAND', 'AHUMADA', 'CONSULTA MEDICA'] },
  { name: 'Servicios', color: '#F39C12', merchants: ['ENEL', 'AGUAS', 'VTR', 'MOVISTAR', 'WOM', 'ENTEL', 'CLARO'] },
  { name: 'Restaurantes', color: '#E67E22', merchants: ['MCDONALD', 'KFC', 'DOMINOS', 'TELEPIZZA', 'SUSHI', 'CAFETERIA'] },
];

function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function upsertCategories() {
  for (const c of CATS) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: { color: c.color },
      create: { name: c.name, color: c.color },
    });
  }
  // Devuelve un mapa {nombre -> Category}
  const all = await prisma.category.findMany();
  return Object.fromEntries(all.map((c) => [c.name, c]));
}

function pickCategoryByMerchant(merchant, catMap) {
  const upper = (merchant || '').toUpperCase();
  for (const def of CATS) {
    if (def.merchants.some((m) => upper.includes(m))) {
      return catMap[def.name];
    }
  }
  // fallback aleatorio leve
  return catMap[randomFrom(CATS).name];
}

async function createUserWithAccounts(catMap, idx) {
  const email = `demo${idx + 1}@bank.cl`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: `Usuario Demo ${idx + 1}`, email, passwordHash: 'x' },
  });

  const accounts = [];
  for (let i = 0; i < CONFIG.ACCOUNTS_PER_USER; i++) {
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        currency: 'CLP',
        balanceCents: 0,
      },
    });
    accounts.push(account);
  }
  return { user, accounts };
}

function generateDailyTxForAccount(accountId, catMap) {
  const start = subMonths(new Date(), CONFIG.MONTHS_BACK);
  const days = eachDayOfInterval({ start, end: new Date() });

  const txs = [];

  // Ingresos mensuales (créditos):
  for (let m = 0; m <= CONFIG.MONTHS_BACK; m++) {
    const dt = subMonths(new Date(), m);
    const payday = new Date(dt.getFullYear(), dt.getMonth(), 5 + Math.floor(Math.random() * 3)); // día 5-7 aprox
    const income = faker.number.int({ min: CONFIG.CREDIT_INCOME_CLP[0], max: CONFIG.CREDIT_INCOME_CLP[1] });
    txs.push({
      id: faker.string.uuid(),
      accountId,
      categoryId: null,
      bookedAt: payday,
      valueCents: income,
      type: 'credit',
      merchant: 'EMPRESA XYZ',
      description: 'Depósito nómina',
      isRecurring: true,
      anomalyScore: null,
      createdAt: payday,
    });
  }

  // Gastos diarios aleatorios:
  for (const d of days) {
    const howMany = Math.random() < 0.2 ? 0 : Math.max(0, Math.round(faker.number.float({ min: 0, max: CONFIG.AVG_TX_PER_DAY + 1 })));
    for (let i = 0; i < howMany; i++) {
      const catName = randomFrom(CATS).name;
      const cat = catMap[catName];

      // Monto base por categoría
      let base;
      switch (catName) {
        case 'Alimentación': base = faker.number.int({ min: 3000, max: 35000 }); break;
        case 'Transporte': base = faker.number.int({ min: 600, max: 15000 }); break;
        case 'Servicios': base = faker.number.int({ min: 5000, max: 60000 }); break;
        case 'Restaurantes': base = faker.number.int({ min: 4000, max: 25000 }); break;
        case 'Entretenimiento': base = faker.number.int({ min: 3000, max: 20000 }); break;
        case 'Salud': base = faker.number.int({ min: 2000, max: 30000 }); break;
        default: base = faker.number.int({ min: 1000, max: 20000 });
      }

      // Comerciante plausible
      const merchant = randomFrom(CATS.find(c => c.name === catName).merchants);
      // Ruido y rarezas para anomalías
      const noisy = Math.random() < 0.04; // 4% anomalías
      const value = noisy ? Math.round(base * faker.number.float({ min: 2.5, max: 6 })) : base;
      const anomalyScore = noisy ? clamp(faker.number.float({ min: 0.7, max: 0.99 }), 0, 1) : null;

      txs.push({
        id: faker.string.uuid(),
        accountId,
        categoryId: cat.id,
        bookedAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), faker.number.int({ min: 8, max: 22 }), faker.number.int({ min: 0, max: 59 })),
        valueCents: -value,
        type: 'debit',
        merchant: merchant,
        description: `${catName} · ${merchant}`,
        isRecurring: false,
        anomalyScore,
        createdAt: d,
      });
    }
  }

  return txs;
}

async function recalcBalance(accountId) {
  const sum = await prisma.transaction.aggregate({
    _sum: { valueCents: true },
    where: { accountId },
  });
  await prisma.account.update({
    where: { id: accountId },
    data: { balanceCents: sum._sum.valueCents ?? 0 },
  });
}

async function main() {
  console.time('seed');

  // 1) Categorías
  const catMap = await upsertCategories();

  // 2) Generar usuarios, cuentas, y transacciones
  for (let u = 0; u < CONFIG.USERS; u++) {
    const { accounts } = await createUserWithAccounts(catMap, u);
    for (const acc of accounts) {
      const txs = generateDailyTxForAccount(acc.id, catMap);
      // Inserción en bloques para rendimiento
      const chunk = 500;
      for (let i = 0; i < txs.length; i += chunk) {
        await prisma.transaction.createMany({ data: txs.slice(i, i + chunk), skipDuplicates: true });
      }
      await recalcBalance(acc.id);
    }
  }

  console.timeEnd('seed');
  console.log('✅ Seed completo.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });