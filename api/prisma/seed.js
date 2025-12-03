// prisma/seed.js
const { PrismaClient, AccountType, Currency, TransactionType } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// contraseña fija de pruebas
const TEST_PASSWORD = 'test1234';

const CATEGORY_DEFS = [
  { code: 'SUPERMERCADO_MINIMARKET', name: 'Supermercado / Minimarket' },
  { code: 'RESTAURANTE_CAFE', name: 'Restaurantes y cafés' },
  { code: 'SUSCRIPCION_DIGITAL', name: 'Suscripciones digitales' },
  { code: 'E_COMMERCE', name: 'E-commerce / pagos en línea' },
  { code: 'SERVICIOS', name: 'Servicios' },
  { code: 'EFECTIVO', name: 'Retiros en efectivo' },
  { code: 'TRANSFERENCIA_SALIENTE', name: 'Transferencias enviadas' },
  { code: 'TRANSFERENCIA_ENTRANTE', name: 'Transferencias recibidas' },
  { code: 'INTERESES', name: 'Intereses' },
  { code: 'OTRAS_COMPRAS', name: 'Otras compras' },
];

const MERCHANTS = {
  SUPERMERCADO_MINIMARKET: [
    'STA ISABEL CURACA',
    'UNIMARC CURACAVI',
    'SBA CURACAVI O HI',
    'PANALERA LAFKEN',
    'HUEVOCENTER',
  ],
  RESTAURANTE_CAFE: [
    'EL POETA 2.0',
    'LOS LAURELES',
    'COMERCIAL FELIPE',
    'UNO SPA.',
  ],
  SUSCRIPCION_DIGITAL: [
    'PRIME VIDEO PRIME',
    'GOOGLE PLAY YOUTU',
    'TWITCH',
    'OPENAI *CHATGPT S',
    'midasbuy.com',
  ],
  E_COMMERCE: [
    'MERCADOPAGO *PANI',
    'MERPAGO*PUNTO23',
    'MERCADOPAGO *MERCADOL',
    'MERPAGO*VENTA',
    'PAGO ONLINE KUSHK',
  ],
  SERVICIOS: [
    'LUZ CATALAN',
    'ENEL',
    'AGUAS ANDINAS',
    'VTR',
    'MOVISTAR',
  ],
  EFECTIVO: ['Giro en Cajero Automatico'],
  TRANSFERENCIA_SALIENTE: [
    'Transf a Xioma',
    'Transf a Victo',
    'Transf a Tio C',
    'Transf a Diego',
    'Transf a Franc',
    'Transf a Fredd',
    'Transf a Sofia',
    'Transf a Beni',
    'Transf a Seba',
    'Transf a Nicol',
  ],
  TRANSFERENCIA_ENTRANTE: [
    'Transf de JUAN',
    'Transf de EMPRESA',
    'Transf de Cliente',
  ],
  INTERESES: ['Intereses Pagados'],
  OTRAS_COMPRAS: [
    'RedGloba*MI CUMPL',
    'RedGloba*TORRES S',
    'HAULMER*AGRO TURI',
    'SOCIEDAD SCORPIO',
  ],
};

// Arquetipos de usuario
const ARCHETYPES = [
  {
    code: 'TRABAJADOR_FORMAL',
    label: 'Trabajador formal con sueldo',
    monthlyIncomeRange: [700000, 1500000], // en pesos
    avgTxPerDay: 2.5,
    probsByCategory: {
      SUPERMERCADO_MINIMARKET: 0.30,
      RESTAURANTE_CAFE: 0.20,
      SUSCRIPCION_DIGITAL: 0.10,
      E_COMMERCE: 0.15,
      SERVICIOS: 0.05,
      EFECTIVO: 0.05,
      TRANSFERENCIA_SALIENTE: 0.10,
      OTRAS_COMPRAS: 0.05,
    },
  },
  {
    code: 'ESTUDIANTE',
    label: 'Estudiante',
    monthlyIncomeRange: [150000, 350000],
    avgTxPerDay: 1.2,
    probsByCategory: {
      SUPERMERCADO_MINIMARKET: 0.25,
      RESTAURANTE_CAFE: 0.25,
      SUSCRIPCION_DIGITAL: 0.15,
      E_COMMERCE: 0.20,
      EFECTIVO: 0.10,
      TRANSFERENCIA_SALIENTE: 0.05,
    },
  },
  {
    code: 'INDEPENDIENTE',
    label: 'Independiente (boletas)',
    monthlyIncomeRange: [800000, 2000000],
    avgTxPerDay: 2.0,
    probsByCategory: {
      SUPERMERCADO_MINIMARKET: 0.25,
      RESTAURANTE_CAFE: 0.15,
      E_COMMERCE: 0.15,
      SERVICIOS: 0.15,
      TRANSFERENCIA_SALIENTE: 0.15,
      EFECTIVO: 0.10,
      SUSCRIPCION_DIGITAL: 0.05,
    },
  },
];

// Helpers
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pickCategoryByProb(probs) {
  const entries = Object.entries(probs);
  const total = entries.reduce((acc, [, p]) => acc + p, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const [cat, p] of entries) {
    acc += p;
    if (r <= acc) return cat;
  }
  return 'SUPERMERCADO_MINIMARKET';
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function setRandomTime(d) {
  const h = randInt(8, 22);
  const m = randInt(0, 59);
  const res = new Date(d);
  res.setHours(h, m, 0, 0);
  return res;
}

// genera montos con sesgo a “gasto hormiga” en categorías típicas
function generateAmountCents(category, isHormigaBias = true) {
  // todos estos valores son en PESOS → se multiplican por 100
  const hormiga = randInt(1000, 5000) * 100; // 1.000 - 5.000
  const normal = randInt(6000, 40000) * 100; // 6.000 - 40.000

  if (!isHormigaBias) return normal;

  if (
    category === 'RESTAURANTE_CAFE' ||
    category === 'SUPERMERCADO_MINIMARKET' ||
    category === 'E_COMMERCE' ||
    category === 'SUSCRIPCION_DIGITAL'
  ) {
    return Math.random() < 0.7 ? hormiga : normal;
  }

  if (category === 'SERVICIOS') {
    return randInt(15000, 80000) * 100;
  }
  if (category === 'EFECTIVO') {
    return randInt(10000, 100000) * 100;
  }
  if (
    category === 'TRANSFERENCIA_SALIENTE' ||
    category === 'TRANSFERENCIA_ENTRANTE'
  ) {
    return randInt(5000, 200000) * 100;
  }
  if (category === 'INTERESES') {
    return randInt(100, 1000) * 100;
  }

  return Math.random() < 0.5 ? hormiga : normal;
}

function buildDescription(category, merchant) {
  if (category === 'TRANSFERENCIA_SALIENTE') {
    if (merchant.startsWith('Transf')) return merchant;
    return `Transf a ${merchant}`;
  }
  if (category === 'TRANSFERENCIA_ENTRANTE') {
    if (merchant.startsWith('Transf')) return merchant;
    return `Transf de ${merchant}`;
  }
  if (category === 'EFECTIVO') {
    return MERCHANTS.EFECTIVO[0];
  }
  if (category === 'INTERESES') {
    return 'Intereses Pagados';
  }
  return `Compra ${merchant}`;
}

async function main() {
  console.log('Reseteando datos (ajusta si no quieres borrar todo)...');

  // Borrar en orden seguro según dependencias
  await prisma.alert.deleteMany();
  await prisma.savingsRule.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const NUM_USERS = 15;
  const DAYS_BACK = 60;
  const today = new Date();

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  console.log('Creando usuarios, cuentas, categorías y transacciones...');

  for (let i = 0; i < NUM_USERS; i++) {
    const archetype = pickOne(ARCHETYPES);
    const [minIncome, maxIncome] = archetype.monthlyIncomeRange;

    // ingreso mensual en pesos y en centavos
    const incomePesos = randInt(minIncome, maxIncome);
    const incomeCents = incomePesos * 100;

    // límite de gasto diario ≈ 1.2 × sueldo / 30
    const maxDailySpendCents = Math.round((incomeCents * 1.2) / 30);

    // 1) Usuario con passwordHash
    const user = await prisma.user.create({
      data: {
        email: `user${i + 1}@demo.cl`,
        name: `${archetype.label} ${i + 1}`,
        passwordHash,
        rut: null,
        phone: null,
      },
    });

    // 2) Categorías para ESTE usuario
    const categoryByCode = {};
    for (const c of CATEGORY_DEFS) {
      const cat = await prisma.category.create({
        data: {
          userId: user.id,
          name: c.name,
          color: null,
          parentId: null,
        },
      });
      categoryByCode[c.code] = cat;
    }

    // 3) Cuenta principal del usuario
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        bank: 'Santander',
        accountType: AccountType.CUENTA_CORRIENTE,
        accountNumber: `0-056-19-${14457 + i}-3`,
        holderName: user.name,
        rutTitular: null,
        alias: 'Cuenta Más Lucas',
        provider: null,
        providerRef: null,
        currency: Currency.CLP,
        balanceCents: 0,
        creditLimitCents: null,
        availableCreditCents: null,
      },
    });

    let accountBalanceCents = 0;

    // 4) Sueldo 2 meses hacia atrás (TRANSFERENCIA_ENTRANTE)
    for (let m = 0; m < 2; m++) {
      const sueldoDate = new Date(
        today.getFullYear(),
        today.getMonth() - m,
        randInt(25, 28),
      );

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          categoryId: categoryByCode['TRANSFERENCIA_ENTRANTE'].id,
          valueCents: incomeCents, // abono
          type: TransactionType.credit,
          merchant: 'EMPRESA',
          description: 'Transf de EMPRESA',
          bookedAt: setRandomTime(sueldoDate),
          postedAt: null,
        },
      });

      accountBalanceCents += incomeCents;
    }

    // 5) Movimientos diarios últimos 60 días (acotados por sueldo)
    for (let d = DAYS_BACK; d >= 0; d--) {
      const date = addDays(today, -d);
      const isWeekend = [0, 6].includes(date.getDay());
      const txToday = isWeekend
        ? Math.max(1, Math.round(archetype.avgTxPerDay * 0.7))
        : Math.round(archetype.avgTxPerDay);

      let spentTodayCents = 0;

      for (let t = 0; t < txToday; t++) {
        const remainingToday = maxDailySpendCents - spentTodayCents;
        if (remainingToday <= 0) break;

        const categoryCode = pickCategoryByProb(archetype.probsByCategory);
        const merchants =
          MERCHANTS[categoryCode] || MERCHANTS.SUPERMERCADO_MINIMARKET;
        const merchant = pickOne(merchants);
        const description = buildDescription(categoryCode, merchant);

        let amountCents = generateAmountCents(categoryCode, true);
        if (amountCents > remainingToday) {
          amountCents = remainingToday;
        }
        if (amountCents <= 0) continue;

        const isHormiga =
          [
            'SUPERMERCADO_MINIMARKET',
            'RESTAURANTE_CAFE',
            'E_COMMERCE',
            'SUSCRIPCION_DIGITAL',
            'OTRAS_COMPRAS',
          ].includes(categoryCode) && amountCents <= 5000 * 100;

        await prisma.transaction.create({
          data: {
            accountId: account.id,
            categoryId: categoryByCode[categoryCode].id,
            valueCents: -amountCents, // débito
            type: TransactionType.debit,
            merchant,
            description,
            bookedAt: setRandomTime(date),
            postedAt: null,
            isGastoHormiga: isHormiga,
          },
        });

        spentTodayCents += amountCents;
        accountBalanceCents -= amountCents;
      }
    }

    // Actualizar saldo final de la cuenta
    await prisma.account.update({
      where: { id: account.id },
      data: {
        balanceCents: accountBalanceCents,
      },
    });

    console.log(`Usuario ${user.email} (${archetype.code}) listo`);
  }

  console.log('Seed completado');
  console.log('Usuario de prueba principal:');
  console.log(`  Email:    user1@demo.cl`);
  console.log(`  Password: ${TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect();
  });
