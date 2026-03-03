/**
 * Product Seeder Script
 *
 * Seeds the database with sample products for development and testing.
 * This script creates approximately 30 mug products with realistic data.
 *
 * Usage:
 *   pnpm db:seed:products
 *
 * Environment:
 *   Requires DATABASE_URL environment variable to be set.
 */
import { createDatabaseContext } from '../db/connection.js';
import { products } from '../db/schema.js';

interface MugProduct {
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string;
  category: string;
  tags: string[];
  currency: string;
  price: string;
  compareAtPrice?: string;
  costPrice: string;
  weight: string;
  width: string;
  height: string;
  length: string;
  status: 'draft' | 'active' | 'archived';
}

const SAMPLE_MUGS: MugProduct[] = [
  {
    name: 'Classic White Ceramic Mug',
    slug: 'classic-white-ceramic-mug',
    sku: 'MUG-CLAS-WHT-001',
    description:
      'A timeless white ceramic mug perfect for your morning coffee or afternoon tea. Dishwasher and microwave safe.',
    shortDescription: 'Classic white ceramic mug for everyday use',
    category: 'Classic',
    tags: ['ceramic', 'white', 'classic', 'dishwasher-safe'],
    currency: 'EUR',
    price: '12.99',
    compareAtPrice: '16.99',
    costPrice: '5.50',
    weight: '350.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Vintage Blue Enamel Camping Mug',
    slug: 'vintage-blue-enamel-camping-mug',
    sku: 'MUG-CAMP-BLU-002',
    description:
      'Durable enamel-coated steel mug with vintage camping aesthetic. Perfect for outdoor adventures or rustic home décor.',
    shortDescription: 'Vintage blue enamel camping mug',
    category: 'Camping',
    tags: ['enamel', 'blue', 'camping', 'vintage', 'outdoor'],
    currency: 'EUR',
    price: '18.50',
    compareAtPrice: '22.00',
    costPrice: '8.25',
    weight: '280.00',
    width: '8.00',
    height: '8.50',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Insulated Stainless Steel Travel Mug',
    slug: 'insulated-stainless-steel-travel-mug',
    sku: 'MUG-TRAV-STL-003',
    description:
      'Double-walled stainless steel travel mug keeps drinks hot for 6 hours or cold for 12 hours. Leak-proof lid included.',
    shortDescription: 'Insulated travel mug with leak-proof lid',
    category: 'Travel',
    tags: ['stainless-steel', 'insulated', 'travel', 'leak-proof'],
    currency: 'EUR',
    price: '29.99',
    compareAtPrice: '39.99',
    costPrice: '14.50',
    weight: '420.00',
    width: '7.50',
    height: '18.00',
    length: '7.50',
    status: 'active',
  },
  {
    name: 'Handmade Pottery Mug - Earth Tones',
    slug: 'handmade-pottery-mug-earth-tones',
    sku: 'MUG-HAND-ERT-004',
    description:
      'Each mug is handcrafted by local artisans with unique earth tone glazes. Slight variations make each piece one-of-a-kind.',
    shortDescription: 'Handmade pottery mug in earth tones',
    category: 'Artisan',
    tags: ['handmade', 'pottery', 'artisan', 'unique', 'earth-tones'],
    currency: 'EUR',
    price: '34.99',
    compareAtPrice: '42.00',
    costPrice: '16.00',
    weight: '400.00',
    width: '9.00',
    height: '10.00',
    length: '9.00',
    status: 'active',
  },
  {
    name: 'Minimalist Black Matte Mug',
    slug: 'minimalist-black-matte-mug',
    sku: 'MUG-MIN-BLK-005',
    description:
      'Sleek minimalist design with matte black finish. Modern aesthetic meets everyday functionality.',
    shortDescription: 'Minimalist black matte ceramic mug',
    category: 'Modern',
    tags: ['ceramic', 'black', 'minimalist', 'modern', 'matte'],
    currency: 'EUR',
    price: '16.99',
    compareAtPrice: '21.99',
    costPrice: '7.25',
    weight: '360.00',
    width: '8.00',
    height: '9.00',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Oversized Soup and Coffee Mug',
    slug: 'oversized-soup-coffee-mug',
    sku: 'MUG-OVER-WHT-006',
    description:
      'Extra large 16oz capacity mug perfect for soup, coffee, or hot chocolate. Wide opening and comfortable handle.',
    shortDescription: 'Oversized 16oz mug for soup or coffee',
    category: 'Oversized',
    tags: ['oversized', 'large', 'ceramic', 'soup', 'coffee'],
    currency: 'EUR',
    price: '19.99',
    compareAtPrice: '24.99',
    costPrice: '9.00',
    weight: '480.00',
    width: '11.00',
    height: '10.00',
    length: '11.00',
    status: 'active',
  },
  {
    name: 'Bamboo Fiber Eco-Friendly Mug',
    slug: 'bamboo-fiber-eco-friendly-mug',
    sku: 'MUG-ECO-BAM-007',
    description:
      'Sustainable mug made from bamboo fiber and cornstarch. Biodegradable, lightweight, and planet-friendly.',
    shortDescription: 'Eco-friendly bamboo fiber mug',
    category: 'Eco',
    tags: ['bamboo', 'eco-friendly', 'sustainable', 'biodegradable'],
    currency: 'EUR',
    price: '14.99',
    compareAtPrice: '18.99',
    costPrice: '6.75',
    weight: '220.00',
    width: '8.00',
    height: '9.00',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Glass Double Wall Espresso Cup',
    slug: 'glass-double-wall-espresso-cup',
    sku: 'MUG-ESPR-GLS-008',
    description:
      'Elegant double-walled borosilicate glass espresso cup. Heat-resistant and creates a floating coffee effect.',
    shortDescription: 'Double-wall glass espresso cup',
    category: 'Espresso',
    tags: ['glass', 'espresso', 'double-wall', 'heat-resistant'],
    currency: 'EUR',
    price: '22.99',
    compareAtPrice: '28.99',
    costPrice: '11.00',
    weight: '180.00',
    width: '6.50',
    height: '6.00',
    length: '6.50',
    status: 'active',
  },
  {
    name: 'Colorful Gradient Rainbow Mug',
    slug: 'colorful-gradient-rainbow-mug',
    sku: 'MUG-RAIN-COL-009',
    description:
      'Vibrant rainbow gradient design brings joy to every sip. Glossy ceramic finish with comfortable C-handle.',
    shortDescription: 'Colorful rainbow gradient ceramic mug',
    category: 'Colorful',
    tags: ['colorful', 'rainbow', 'gradient', 'ceramic', 'vibrant'],
    currency: 'EUR',
    price: '15.99',
    compareAtPrice: '19.99',
    costPrice: '7.00',
    weight: '340.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Rustic Stoneware Mug - Charcoal',
    slug: 'rustic-stoneware-mug-charcoal',
    sku: 'MUG-RUST-CHA-010',
    description:
      'Heavy-duty stoneware mug with rustic charcoal glaze. Perfect for farmhouse or industrial kitchen styles.',
    shortDescription: 'Rustic charcoal stoneware mug',
    category: 'Rustic',
    tags: ['stoneware', 'rustic', 'charcoal', 'heavy-duty'],
    currency: 'EUR',
    price: '17.99',
    compareAtPrice: '22.99',
    costPrice: '8.50',
    weight: '450.00',
    width: '9.00',
    height: '10.50',
    length: '9.00',
    status: 'active',
  },
  {
    name: 'Dad Joke Novelty Mug',
    slug: 'dad-joke-novelty-mug',
    sku: 'MUG-NOV-DAD-011',
    description:
      'White ceramic mug with hilarious dad joke printed in bold letters. Perfect gift for the pun-loving parent.',
    shortDescription: 'Novelty mug with dad joke',
    category: 'Novelty',
    tags: ['novelty', 'funny', 'gift', 'white', 'ceramic'],
    currency: 'EUR',
    price: '13.99',
    costPrice: '5.75',
    weight: '340.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Copper Plated Moscow Mule Mug',
    slug: 'copper-plated-moscow-mule-mug',
    sku: 'MUG-COPP-MUL-012',
    description:
      'Classic copper-plated stainless steel mug designed for Moscow Mules. Keeps drinks ice-cold and looks elegant.',
    shortDescription: 'Copper Moscow Mule mug',
    category: 'Barware',
    tags: ['copper', 'barware', 'moscow-mule', 'stainless-steel'],
    currency: 'EUR',
    price: '24.99',
    compareAtPrice: '32.00',
    costPrice: '12.00',
    weight: '300.00',
    width: '8.00',
    height: '10.00',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Floral Print Bone China Mug',
    slug: 'floral-print-bone-china-mug',
    sku: 'MUG-FLOR-BON-013',
    description:
      'Delicate bone china mug with vintage floral print. Lightweight, elegant, and perfect for afternoon tea.',
    shortDescription: 'Floral bone china tea mug',
    category: 'Tea',
    tags: ['bone-china', 'floral', 'tea', 'vintage', 'elegant'],
    currency: 'EUR',
    price: '26.99',
    compareAtPrice: '34.99',
    costPrice: '13.00',
    weight: '240.00',
    width: '9.00',
    height: '8.50',
    length: '9.00',
    status: 'active',
  },
  {
    name: 'Programmer Code Mug',
    slug: 'programmer-code-mug',
    sku: 'MUG-CODE-PRG-014',
    description:
      'Black ceramic mug with colorful code syntax highlighting. Perfect for developers fueled by coffee.',
    shortDescription: 'Code-themed mug for programmers',
    category: 'Novelty',
    tags: ['novelty', 'programmer', 'code', 'tech', 'black'],
    currency: 'EUR',
    price: '15.99',
    costPrice: '6.50',
    weight: '350.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Japanese Ceramic Tea Mug with Lid',
    slug: 'japanese-ceramic-tea-mug-lid',
    sku: 'MUG-JAP-TEA-015',
    description:
      'Authentic Japanese-style ceramic mug with matching lid and infuser. Traditional cherry blossom design.',
    shortDescription: 'Japanese tea mug with lid',
    category: 'Tea',
    tags: ['japanese', 'tea', 'ceramic', 'lid', 'infuser'],
    currency: 'EUR',
    price: '31.99',
    compareAtPrice: '39.99',
    costPrice: '15.00',
    weight: '420.00',
    width: '8.00',
    height: '11.00',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Set of 4 Stackable Mugs - Pastel',
    slug: 'set-4-stackable-mugs-pastel',
    sku: 'MUG-SET-PAS-016',
    description:
      'Space-saving stackable mugs in soft pastel colors (pink, blue, yellow, mint). Sold as a set of 4.',
    shortDescription: '4 stackable pastel mugs',
    category: 'Sets',
    tags: ['set', 'stackable', 'pastel', 'ceramic', 'space-saving'],
    currency: 'EUR',
    price: '44.99',
    compareAtPrice: '54.99',
    costPrice: '20.00',
    weight: '1200.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Heat-Activated Color Changing Mug',
    slug: 'heat-activated-color-changing-mug',
    sku: 'MUG-HEAT-COL-017',
    description:
      'Magic mug reveals hidden design when filled with hot liquid. Black exterior transforms to vibrant colors.',
    shortDescription: 'Heat-activated color changing mug',
    category: 'Novelty',
    tags: ['novelty', 'heat-activated', 'color-changing', 'magic'],
    currency: 'EUR',
    price: '18.99',
    costPrice: '8.00',
    weight: '370.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Viking Drinking Horn Mug',
    slug: 'viking-drinking-horn-mug',
    sku: 'MUG-VIK-HRN-018',
    description:
      'Ceramic mug shaped like a Viking drinking horn with medieval-inspired design. Includes display stand.',
    shortDescription: 'Viking horn-shaped ceramic mug',
    category: 'Novelty',
    tags: ['novelty', 'viking', 'horn', 'medieval', 'ceramic'],
    currency: 'EUR',
    price: '27.99',
    compareAtPrice: '35.99',
    costPrice: '13.50',
    weight: '520.00',
    width: '10.00',
    height: '15.00',
    length: '10.00',
    status: 'active',
  },
  {
    name: 'Elegant Gold Rim Marble Mug',
    slug: 'elegant-gold-rim-marble-mug',
    sku: 'MUG-MARB-GLD-019',
    description:
      'Luxurious marble pattern with metallic gold rim. Perfect for special occasions or as a decorative piece.',
    shortDescription: 'Marble mug with gold rim',
    category: 'Luxury',
    tags: ['marble', 'gold', 'luxury', 'elegant', 'ceramic'],
    currency: 'EUR',
    price: '28.99',
    compareAtPrice: '36.99',
    costPrice: '13.75',
    weight: '380.00',
    width: '8.50',
    height: '10.00',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Self-Stirring Electric Mug',
    slug: 'self-stirring-electric-mug',
    sku: 'MUG-ELEC-STR-020',
    description:
      'Battery-powered self-stirring mug with button-activated mixing blade. Perfect for hot chocolate and protein shakes.',
    shortDescription: 'Electric self-stirring mug',
    category: 'Tech',
    tags: ['electric', 'tech', 'self-stirring', 'gadget'],
    currency: 'EUR',
    price: '32.99',
    compareAtPrice: '42.99',
    costPrice: '16.50',
    weight: '450.00',
    width: '8.50',
    height: '11.00',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Camping Mug with Carabiner Handle',
    slug: 'camping-mug-carabiner-handle',
    sku: 'MUG-CAMP-CAR-021',
    description:
      'Lightweight aluminum camping mug with built-in carabiner handle. Clips to backpack for easy transport.',
    shortDescription: 'Camping mug with carabiner',
    category: 'Camping',
    tags: ['camping', 'aluminum', 'carabiner', 'outdoor', 'lightweight'],
    currency: 'EUR',
    price: '16.99',
    compareAtPrice: '21.99',
    costPrice: '7.50',
    weight: '180.00',
    width: '8.00',
    height: '8.00',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Vintage Diner Style Mug',
    slug: 'vintage-diner-style-mug',
    sku: 'MUG-DIN-VIN-022',
    description:
      'Heavy ceramic mug reminiscent of classic American diners. Thick walls retain heat, wide rim for easy sipping.',
    shortDescription: 'Vintage diner-style ceramic mug',
    category: 'Vintage',
    tags: ['vintage', 'diner', 'ceramic', 'retro', 'heavy-duty'],
    currency: 'EUR',
    price: '14.99',
    compareAtPrice: '18.99',
    costPrice: '6.25',
    weight: '480.00',
    width: '9.50',
    height: '9.00',
    length: '9.50',
    status: 'active',
  },
  {
    name: 'Cat Paw Print Interior Mug',
    slug: 'cat-paw-print-interior-mug',
    sku: 'MUG-CAT-PAW-023',
    description:
      'White ceramic mug with adorable cat paw prints revealed at the bottom as you drink. Perfect gift for cat lovers.',
    shortDescription: 'Cat paw print surprise mug',
    category: 'Novelty',
    tags: ['novelty', 'cat', 'paw-print', 'gift', 'animal'],
    currency: 'EUR',
    price: '16.99',
    costPrice: '7.00',
    weight: '350.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Porcelain Latte Bowl Mug',
    slug: 'porcelain-latte-bowl-mug',
    sku: 'MUG-LAT-BOW-024',
    description:
      'Wide-mouth French-style latte bowl in smooth white porcelain. Perfect for café au lait or cappuccino.',
    shortDescription: 'French-style latte bowl',
    category: 'Coffee',
    tags: ['porcelain', 'latte', 'french', 'bowl', 'white'],
    currency: 'EUR',
    price: '21.99',
    compareAtPrice: '27.99',
    costPrice: '10.50',
    weight: '410.00',
    width: '12.00',
    height: '7.00',
    length: '12.00',
    status: 'active',
  },
  {
    name: 'Smart Temperature Display Mug',
    slug: 'smart-temperature-display-mug',
    sku: 'MUG-SMART-TMP-025',
    description:
      'High-tech mug with LED temperature display on the side. Shows drink temperature in real-time (50-100°C).',
    shortDescription: 'Smart mug with temperature display',
    category: 'Tech',
    tags: ['tech', 'smart', 'temperature', 'led', 'gadget'],
    currency: 'EUR',
    price: '39.99',
    compareAtPrice: '49.99',
    costPrice: '19.00',
    weight: '400.00',
    width: '8.50',
    height: '10.00',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Insulated Ceramic Travel Mug',
    slug: 'insulated-ceramic-travel-mug',
    sku: 'MUG-INS-CER-026',
    description:
      'Double-walled ceramic travel mug combines the elegance of ceramic with travel functionality. Silicone lid included.',
    shortDescription: 'Insulated ceramic travel mug',
    category: 'Travel',
    tags: ['ceramic', 'insulated', 'travel', 'double-wall', 'lid'],
    currency: 'EUR',
    price: '26.99',
    compareAtPrice: '33.99',
    costPrice: '12.75',
    weight: '440.00',
    width: '8.00',
    height: '15.00',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Motivational Quote Mug',
    slug: 'motivational-quote-mug',
    sku: 'MUG-MOT-QUO-027',
    description:
      'Start your day with inspiration. White ceramic mug with bold motivational quote in modern typography.',
    shortDescription: 'Motivational quote ceramic mug',
    category: 'Novelty',
    tags: ['motivational', 'quote', 'inspiration', 'white', 'ceramic'],
    currency: 'EUR',
    price: '13.99',
    costPrice: '5.75',
    weight: '340.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Crystal Clear Glass Mug',
    slug: 'crystal-clear-glass-mug',
    sku: 'MUG-GLAS-CLR-028',
    description:
      'Simple and elegant clear glass mug. Heat-resistant borosilicate glass shows off the beautiful colors of your beverages.',
    shortDescription: 'Clear glass mug',
    category: 'Glass',
    tags: ['glass', 'clear', 'borosilicate', 'heat-resistant', 'minimalist'],
    currency: 'EUR',
    price: '17.99',
    compareAtPrice: '22.99',
    costPrice: '8.25',
    weight: '280.00',
    width: '8.00',
    height: '10.00',
    length: '8.00',
    status: 'active',
  },
  {
    name: 'Retro 80s Geometric Pattern Mug',
    slug: 'retro-80s-geometric-pattern-mug',
    sku: 'MUG-RET-80S-029',
    description:
      'Bring back the 80s with this vibrant geometric pattern mug. Glossy finish in bold neon colors.',
    shortDescription: 'Retro 80s geometric mug',
    category: 'Retro',
    tags: ['retro', '80s', 'geometric', 'colorful', 'neon'],
    currency: 'EUR',
    price: '15.99',
    compareAtPrice: '19.99',
    costPrice: '6.75',
    weight: '350.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'active',
  },
  {
    name: 'Personalized Name Engraved Mug',
    slug: 'personalized-name-engraved-mug',
    sku: 'MUG-PERS-NAM-030',
    description:
      'Custom ceramic mug with laser-engraved name. Make it uniquely yours or order as a thoughtful personalized gift.',
    shortDescription: 'Personalized engraved mug',
    category: 'Personalized',
    tags: ['personalized', 'custom', 'engraved', 'gift', 'ceramic'],
    currency: 'EUR',
    price: '24.99',
    costPrice: '11.00',
    weight: '360.00',
    width: '8.50',
    height: '9.50',
    length: '8.50',
    status: 'draft',
  },
];

async function seedProducts() {
  console.log('🌱 Starting product seeding...\n');

  const { db, close } = createDatabaseContext();

  try {
    console.log('📦 Preparing to insert products...');
    console.log(`   Total products to seed: ${SAMPLE_MUGS.length}\n`);

    console.log('🗑️  Clearing existing products...');
    await db.delete(products);
    console.log('   ✓ Existing products cleared\n');

    console.log('📝 Inserting new products...');
    const insertedProducts = await db.insert(products).values(SAMPLE_MUGS).returning();
    console.log(`   ✓ Successfully inserted ${insertedProducts.length} products\n`);

    console.log('📊 Seeding summary:');
    console.log(`   - Total products: ${insertedProducts.length}`);
    console.log(`   - Active products: ${insertedProducts.filter((p) => p.status === 'active').length}`);
    console.log(`   - Draft products: ${insertedProducts.filter((p) => p.status === 'draft').length}`);
    console.log(`   - Archived products: ${insertedProducts.filter((p) => p.status === 'archived').length}`);

    const categories = new Set(insertedProducts.map((p) => p.category));
    console.log(`   - Categories: ${categories.size}`);
    console.log(`     ${Array.from(categories).join(', ')}\n`);

    console.log('✅ Product seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  } finally {
    await close();
    console.log('\n🔌 Database connection closed');
  }
}

void seedProducts();
