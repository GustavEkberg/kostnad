import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { category, merchantMapping } from './schema';

config({ path: '.env' });

const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL env variable not found');
  return url;
};

const DEFAULT_CATEGORIES = [
  {
    name: 'Mat & Dagligvaror',
    description: 'Mataffärer, livsmedel, hushållsartiklar',
    icon: '🛒',
    isDefault: true
  },
  {
    name: 'Restaurang & Café',
    description: 'Utemat, fika, matleveranser',
    icon: '🍽️',
    isDefault: true
  },
  {
    name: 'Transport',
    description: 'Bensin, parkering, kollektivtrafik, bil',
    icon: '🚗',
    isDefault: true
  },
  {
    name: 'Boende',
    description: 'Hyra, el, vatten, försäkring, internet',
    icon: '🏠',
    isDefault: true
  },
  {
    name: 'Nöje & Fritid',
    description: 'Bio, spel, streaming, hobbies',
    icon: '🎬',
    isDefault: true
  },
  {
    name: 'Shopping',
    description: 'Kläder, elektronik, inredning, presenter',
    icon: '🛍️',
    isDefault: true
  },
  {
    name: 'Hälsa & Skönhet',
    description: 'Apotek, läkare, träning, hygien',
    icon: '❤️',
    isDefault: true
  },
  {
    name: 'Resor',
    description: 'Hotell, flyg, semester, utflykter',
    icon: '✈️',
    isDefault: true
  },
  {
    name: 'Barn & Familj',
    description: 'Barnkläder, leksaker, förskola, aktiviteter',
    icon: '👶',
    isDefault: true
  },
  {
    name: 'Inkomst',
    description: 'Lön, bidrag, återbetalningar, överföringar in',
    icon: '💰',
    isDefault: true
  },
  {
    name: 'Övrigt',
    description: 'Okategoriserat, diverse utgifter',
    icon: '📦',
    isDefault: true
  }
] as const;

// Merchant patterns mapped to category names
// Patterns are case-insensitive substrings to match against merchant names
const MERCHANT_MAPPINGS: Record<string, readonly string[]> = {
  'Mat & Dagligvaror': [
    'ICA',
    'COOP',
    'HEMKOP',
    'MAXI ICA',
    'Systembolaget',
    'BARABRAMAT',
    'Gudagott',
    'BAGERIET',
    'WILLYS',
    'LIDL',
    'NETTO'
  ],
  'Restaurang & Café': [
    'Foodora',
    'PizzaTime',
    'BISTRO',
    'CUMPANE',
    'Coffee Lab',
    'da Matteo',
    'NOSTRANO',
    'TOUIS THAI',
    'TRANS SIBERIAN',
    'TOSSESTUGAN',
    'STORKEN',
    'Medelhavs',
    'Fiskverkstan',
    'ESPRESSO HOUSE',
    'MAX HAMBUR',
    'MCDONALDS'
  ],
  Transport: [
    'Circle K',
    'OKQ8',
    'St1',
    'EasyPark',
    'PARKERING',
    'TRÄNGSELSKAT',
    'Transportstyre',
    'DACK I VAST',
    'PREEM',
    'VÄSTTRAFIK',
    'SJ AB',
    'SL'
  ],
  Boende: ['GÖTEBORG ENERG', 'ELEKTROTEKNISK', 'HYRA', 'TELIA', 'COMHEM', 'RIKSBYGGEN'],
  Shopping: [
    'JYSK',
    'HEMTEX',
    'BAUHAUS',
    'Zettle_*Brandt',
    'The Beauty Fac',
    'Lillak',
    'W*gp.se',
    'LOOMISP',
    'EKBERGS',
    'HM',
    'IKEA',
    'ELGIGANTEN',
    'MEDIAMARKT'
  ],
  'Hälsa & Skönhet': ['APOTEK', 'Kronans Apotek', 'VÅRDCENTRAL', 'TANDLÄK', 'GYM', 'SATS'],
  Resor: ['HOTEL', 'STORHOGNA SPA', 'KLOVSJO', 'HotelBishops', 'HOTELL ANNO', 'HOTELCOM', 'SAS'],
  'Barn & Familj': ['BABYSAM', 'LEKIA', 'BR LEK', 'BARNKLÄD'],
  Inkomst: ['Lön', 'FÖRSÄKRINGSKASS', 'SKATTEVERKET'],
  Övrigt: ['Överf Mobil', 'UBR*', 'Prel', 'NMB*', 'G feb', 'AKTIEBOLAGET']
};

async function seed() {
  const db = drizzle({ connection: getDatabaseUrl(), casing: 'snake_case' });

  console.log('Seeding default categories...');

  for (const cat of DEFAULT_CATEGORIES) {
    await db
      .insert(category)
      .values(cat)
      .onConflictDoUpdate({
        target: category.name,
        set: { icon: cat.icon, description: cat.description }
      });
  }

  console.log('Seeding merchant mappings...');

  // Get all categories to map names to IDs
  const categories = await db.select().from(category);
  const categoryByName = new Map(categories.map(c => [c.name, c.id]));

  for (const [categoryName, patterns] of Object.entries(MERCHANT_MAPPINGS)) {
    const categoryId = categoryByName.get(categoryName);
    if (!categoryId) {
      console.warn(`Category "${categoryName}" not found, skipping mappings`);
      continue;
    }

    for (const pattern of patterns) {
      await db
        .insert(merchantMapping)
        .values({ merchantPattern: pattern, categoryId })
        .onConflictDoUpdate({
          target: merchantMapping.merchantPattern,
          set: { categoryId }
        });
    }
  }

  console.log('Seeding complete.');
  await db.$client.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
