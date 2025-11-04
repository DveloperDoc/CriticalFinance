/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');
const { subMonths, eachDayOfInterval } = require('date-fns');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Convención:
 * - valueCents guarda PESOS CHILENOS sin decimales (CLP no usa centavos). Ej: $3.500 => 3500.
 * - Débitos (gastos) NEGATIVOS. Créditos (ingresos) POSITIVOS.
 */

const CONFIG = {
  USERS: 1,
  ACCOUNTS_PER_USER: 1,
  MONTHS_BACK: 6,
  AVG_TX_PER_DAY: 2.2,
  FIXED_INCOME_CLP: 800000, // sueldo mensual fijo
};

// Catálogo base por usuario
const CATS = [
  { name: 'Alimentación', color: '#FF6347', merchants: ['LIDER', 'JUMBO', 'TOTTUS', 'UNIMARC', 'SANTA ISABEL', 'MINIMARKET'] },
  { name: 'Transporte',  color: '#1E90FF', merchants: ['RED METRO', 'UBER', 'DIDI', 'CABIFY', 'COPEC', 'SHELL', 'PETROBRAS'] },
  { name: 'Entretenimiento', color: '#9B59B6', merchants: ['NETFLIX', 'SPOTIFY', 'STEAM', 'CINEMARK', 'CINEHOYTS'] },
  { name: 'Salud', color: '#2ECC71', merchants: ['CRUZ VERDE', 'SALCOBRAND', 'AHUMADA', 'CONSULTA MÉDICA'] },
  { name: 'Servicios', color: '#F39C12', merchants: ['ENEL', 'AGUAS', 'VTR', 'MOVISTAR', 'WOM', 'ENTEL', 'CLARO'] },
  { name: 'Restaurantes', color: '#E67E22', merchants: ['MCDONALD\'S', 'KFC', 'DOMINO\'S', 'SUSHI', 'CAFETERÍA'] },
];

const rnd = (min, max) => faker.number.int({ min, max });
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const extId = (accountId, date, valueCents, desc) =>
  crypto.createHash('sha1').update(`${accountId}|${date.toISOString()}|${valueCents}|${desc || ''}`).digest('hex');

async function upsertUser(idx) {
  const email = `demo${idx + 1}@bank.cl`;
  const passwordHash = await bcrypt.hash('123456', 10);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      name: `Usuario Demo ${idx + 1}`,
      email,
      passwordHash,
      rut: '11111111-1',
      phone: '+56911111111',
    },
  });
}

async function ensureUserCategories(userId) {
  await prisma.category.createMany({
    data: CATS.map(c => ({ userId, name: c.name, color: c.color })),
    skipDuplicates: true,
  });
  const cats = await prisma.category.findMany({ where: { userId } });
  return Object.fromEntries(cats.map(c => [c.name, c]));
}

async function createAccountsForUser(userId) {
  const accounts = [];
  for (let i = 0; i < CONFIG.ACCOUNTS_PER_USER; i++) {
    const bank = pick(['BancoEstado', 'Santander', 'BCI', 'Scotiabank', 'Itau']);
    const accountType = 'CUENTA_VISTA'; // enum AccountType
    const accountNumber = faker.string.numeric(8);
    const holderName = 'Usuario Demo';
    const rutTitular = '11111111-1';

    const acc = await prisma.account.upsert({
      where: {
        userId_bank_accountType_accountNumber: { userId, bank, accountType, accountNumber },
      },
      update: {},
      create: {
        userId,
        bank,
        accountType,
        accountNumber,
        holderName,
        rutTitular,
        currency: 'CLP',
        alias: 'Cuenta principal',
        active: true,
        provider: 'mock',
        providerRef: null,
        balanceCents: 0,
      },
    });
    accounts.push(acc);
  }
  return accounts;
}

function rangeForCategory(name) {
  switch (name) {
    case 'Alimentación': return [3000, 35000];
    case 'Transporte': return [600, 15000];
    case 'Servicios': return [5000, 60000];
    case 'Restaurantes': return [4000, 25000];
    case 'Entretenimiento': return [3000, 20000];
    case 'Salud': return [2000, 30000];
    default: return [1000, 20000];
  }
}

function generateDailyTxForAccount(accountId, catMap) {
  const start = subMonths(new Date(), CONFIG.MONTHS_BACK);
  const days = eachDayOfInterval({ start, end: new Date() });

  const txs = [];

  // Ingresos mensuales fijos: $800.000 el día 5-7
  for (let m = 0; m <= CONFIG.MONTHS_BACK; m++) {
    const dt = subMonths(new Date(), m);
    const payday = new Date(dt.getFullYear(), dt.getMonth(), 5 + rnd(0, 2), 10, 0, 0);
    const amount = CONFIG.FIXED_INCOME_CLP; // CLP
    const eid = extId(accountId, payday, amount, 'Sueldo');

    txs.push({
      id: faker.string.uuid(),
      accountId,
      categoryId: null,
      bookedAt: payday,
      postedAt: payday,
      valueCents: amount,   // crédito positivo
      type: 'credit',
      merchant: 'EMPRESA DEMO',
      description: 'Sueldo',
      isRecurring: true,
      anomalyScore: null,
      balanceAfterCents: null,
      createdAt: payday,
      externalId: eid,
    });
  }

  // Gastos diarios aleatorios
  for (const d of days) {
    const howMany = Math.random() < 0.2 ? 0 : Math.max(0, Math.round(faker.number.float({ min: 0, max: CONFIG.AVG_TX_PER_DAY + 1 })));
    for (let i = 0; i < howMany; i++) {
      const def = pick(CATS);
      const [minV, maxV] = rangeForCategory(def.name);
      const value = rnd(minV, maxV);     // CLP
      const merchant = pick(def.merchants);
      const when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), rnd(8, 22), rnd(0, 59));

      const eid = extId(accountId, when, -value, `${def.name} · ${merchant}`);

      txs.push({
        id: faker.string.uuid(),
        accountId,
        categoryId: catMap[def.name].id,
        bookedAt: when,
        postedAt: when,
        valueCents: -value,  // débito negativo
        type: 'debit',
        merchant,
        description: `${def.name} · ${merchant}`,
        isRecurring: false,
        anomalyScore: Math.random() < 0.04 ? faker.number.float({ min: 0.7, max: 0.99 }) : null,
        balanceAfterCents: null,
        createdAt: when,
        externalId: eid,
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

  for (let u = 0; u < CONFIG.USERS; u++) {
    const user = await upsertUser(u);
    const catMap = await ensureUserCategories(user.id);
    const accounts = await createAccountsForUser(user.id);

    for (const acc of accounts) {
      const txs = generateDailyTxForAccount(acc.id, catMap);

      // Inserta por lotes con idempotencia por externalId
      const chunk = 500;
      for (let i = 0; i < txs.length; i += chunk) {
        await prisma.transaction.createMany({ data: txs.slice(i, i + chunk), skipDuplicates: true });
      }

      await recalcBalance(acc.id);
    }
  }

  console.timeEnd('seed');
  console.log('✅ Seed completo. Usuario: demo1@bank.cl / pass: 123456');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });
