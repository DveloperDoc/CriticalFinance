// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  TRANSFERENCIA_ENTRANTE: ['Transf de JUAN', 'Transf de EMPRESA', 'Transf de Cliente'],
  INTERESES: ['Intereses Pagados'],
  OTRAS_COMPRAS: [
    'RedGloba*MI CUMPL',
    'RedGloba*TORRES S',
    'HAULMER*AGRO TURI',
    'SOCIEDAD SCORPIO',
  ],
};

// Solo 3 arquetipos: trabajador formal, estudiante, independiente
const ARCHETYPES = [
  {
    code: 'TRABAJADOR_FORMAL',
    label: 'Trabajador formal con sueldo',
    monthlyIncomeRange: [700000, 1500000],
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
  const hormiga = randInt(1000, 5000) * 100;
  const normal = randInt(6000, 40000) * 100;

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
  if (category === 'TRANSFERENCIA_SALIENTE' || category === 'TRANSFERENCIA_ENTRANTE') {
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
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creando categorías...');
  const categories = [];
  for (const c of CATEGORY_DEFS) {
    // OJO: si tu modelo Category NO tiene campo "code",
    // cambia "code: c.code" por otra cosa o elimínalo.
    const cat = await prisma.category.create({
      data: {
        code: c.code,
        name: c.name,
      },
    });
    categories.push(cat);
  }

  const categoryByCode = {};
  for (const c of categories) {
    categoryByCode[c.code] = c;
  }

  const NUM_USERS = 15;
  const DAYS_BACK = 60;
  const today = new Date();

  console.log('Creando usuarios, cuentas y transacciones...');
  for (let i = 0; i < NUM_USERS; i++) {
    const archetype = pickOne(ARCHETYPES);
    const [minIncome, maxIncome] = archetype.monthlyIncomeRange;
    const income = randInt(minIncome, maxIncome);

    const user = await prisma.user.create({
      data: {
        email: `user${i + 1}@demo.cl`,
        name: `${archetype.label} ${i + 1}`,
      },
    });

    const account = await prisma.account.create({
      data: {
        name: 'Cuenta Más Lucas',
        number: `0-056-19-${14457 + i}-3`,
        bank: 'Santander',
        userId: user.id,
      },
    });

    // Sueldo 2 meses hacia atrás
    for (let m = 0; m < 2; m++) {
      const sueldoDate = new Date(
        today.getFullYear(),
        today.getMonth() - m,
        randInt(25, 28),
      );
      const sueldoAmountCents = income * 100;

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          categoryId: categoryByCode['TRANSFERENCIA_ENTRANTE'].id,
          valueCents: sueldoAmountCents, // abono
          merchant: 'EMPRESA',
          description: 'Transf de EMPRESA',
          bookedAt: setRandomTime(sueldoDate),
        },
      });
    }

    for (let d = DAYS_BACK; d >= 0; d--) {
      const date = addDays(today, -d);
      const isWeekend = [0, 6].includes(date.getDay());
      const txToday = isWeekend
        ? Math.max(1, Math.round(archetype.avgTxPerDay * 0.7))
        : Math.round(archetype.avgTxPerDay);

      for (let t = 0; t < txToday; t++) {
        const categoryCode = pickCategoryByProb(archetype.probsByCategory);
        const merchants = MERCHANTS[categoryCode] || MERCHANTS.SUPERMERCADO_MINIMARKET;
        const merchant = pickOne(merchants);
        const description = buildDescription(categoryCode, merchant);
        const amountCents = generateAmountCents(categoryCode, true);

        const isHormiga =
          ['SUPERMERCADO_MINIMARKET', 'RESTAURANTE_CAFE', 'E_COMMERCE', 'SUSCRIPCION_DIGITAL', 'OTRAS_COMPRAS'].includes(
            categoryCode,
          ) && amountCents <= 5000 * 100;

        await prisma.transaction.create({
          data: {
            accountId: account.id,
            categoryId: categoryByCode[categoryCode].id,
            valueCents: -amountCents, // débito
            merchant,
            description,
            bookedAt: setRandomTime(date),
            // Si tienes JSON de features podrías guardar el flag hormiga:
            // features: { isHormigaSeed: isHormiga },
          },
        });
      }
    }

    console.log(`Usuario ${user.email} (${archetype.code}) listo`);
  }

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect();
  });
