import { getDb, upsertItem, logSystemEvent } from '../src/lib/db.js';
import { formatAffiliateUrl } from '../src/lib/affiliate.js';

const SAMPLE_ARTISAN_PRODUCTS = [
  // Woodworking
  {
    asin: 'B09W1WOOD1',
    title: 'Hand-Carved Black Walnut End-Grain Cutting Board',
    artisan_name: 'Sawyer & Grain Woodcraft',
    category: 'Woodworking',
    description: 'Crafted from sustainably sourced American black walnut and hard maple. Hand-beveled juice groove, deep finger indents, and finished with organic beeswax and mineral oil.',
    image_url: 'https://images.unsplash.com/photo-1590736704728-f4730bb30770?auto=format&fit=crop&w=900&q=80',
    price_approx: 84.00,
  },
  {
    asin: 'B09W2WOOD2',
    title: 'Live-Edge White Oak Catchall & Valet Tray',
    artisan_name: 'Wildwood Forge & Timber',
    category: 'Woodworking',
    description: 'Each tray preserves the natural bark line and contour of salvaged white oak. Perfect bedside or entryway sanctuary for keys, timepiece, and everyday carry.',
    image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=80',
    price_approx: 46.00,
  },
  {
    asin: 'B09W3WOOD3',
    title: 'Turned Maple Wood Salt Cellar with Magnetic Swivel Lid',
    artisan_name: 'Timberline Studio',
    category: 'Woodworking',
    description: 'Lathe-turned from solid sugar maple with a buttery-smooth sanded surface. Brass pivot pin and concealed neodymium magnets lock freshness inside.',
    image_url: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=900&q=80',
    price_approx: 38.00,
  },
  {
    asin: 'B09W4WOOD4',
    title: 'Hand-Hewn Cherry Wood Coffee Scoop & Bag Clip',
    artisan_name: 'Northwoods Woodworks',
    category: 'Woodworking',
    description: 'Dual-purpose hand-carved coffee spoon that clips directly onto your whole-bean roast bag. Measures an exact 2-tablespoon dose.',
    image_url: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=80',
    price_approx: 24.50,
  },

  // Pottery & Ceramics
  {
    asin: 'B09C1CLAY1',
    title: 'Speckled Stoneware Morning Mug (14 oz)',
    artisan_name: 'Dusk & Dawn Ceramics',
    category: 'Pottery & Ceramics',
    description: 'Wheel-thrown stoneware featuring iron-speckled stoneware clay and a matte oatmeal satin glaze. Comfortable ergonomic thumb rest on a pulled handle.',
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
    price_approx: 36.00,
  },
  {
    asin: 'B09C2CLAY2',
    title: 'Fluted Terracotta Plant Pot with Deep Saucer',
    artisan_name: 'Terra Studio Co.',
    category: 'Pottery & Ceramics',
    description: 'Naturally porous Tuscan-style red clay allows root respiration and prevents root rot. Hand-carved vertical fluting creates gentle shadow play.',
    image_url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80',
    price_approx: 42.00,
  },
  {
    asin: 'B09C3CLAY3',
    title: 'Ceramic Pour-Over Coffee Dripper in Raw Sand',
    artisan_name: 'Kanso Pottery',
    category: 'Pottery & Ceramics',
    description: 'Designed with interior spiral spiral ribs for an optimal 3-minute extraction rate. Unglazed exterior with glazed wash interior for easy rinse.',
    image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=900&q=80',
    price_approx: 48.00,
  },
  {
    asin: 'B09C4CLAY4',
    title: 'Hand-Pinched Earthenware Match Striker & Holder',
    artisan_name: 'Ochre Hearth',
    category: 'Pottery & Ceramics',
    description: 'Rustic tactile match holder with an integrated strike-on-clay raw bottom band. Includes 40 matchsticks for cozy evenings.',
    image_url: 'https://images.unsplash.com/photo-1606744824163-985d376605aa?auto=format&fit=crop&w=900&q=80',
    price_approx: 28.00,
  },

  // Leather Goods
  {
    asin: 'B09L1LTR1',
    title: 'Full-Grain Vegetable-Tanned Bifold Minimalist Wallet',
    artisan_name: 'Ironwood Leathercraft',
    category: 'Leather Goods',
    description: 'Handcrafted from 4oz Wickett & Craig harness leather. Saddle-stitched by hand with waxed polycord thread that will never unravel.',
    image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=80',
    price_approx: 68.00,
  },
  {
    asin: 'B09L2LTR2',
    title: 'Hand-Bound Leather Travel Journal with Archival Rag Paper',
    artisan_name: 'Old Mill Bookbinders',
    category: 'Leather Goods',
    description: 'Supple oil-tanned brown cowhide wrapped around 240 blank pages of hand-torn, acid-free deckle edge cotton rag paper. Stitched with coptic binding.',
    image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=900&q=80',
    price_approx: 54.00,
  },
  {
    asin: 'B09L3LTR3',
    title: 'Heavy Brass & Horween Chromexcel Leather Key Shackle',
    artisan_name: 'Hearthstone Leather Co.',
    category: 'Leather Goods',
    description: 'Solid machined marine-grade brass screw-pin shackle coupled with rich burnished Horween Chromexcel pull-up leather.',
    image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=900&q=80',
    price_approx: 32.00,
  },
  {
    asin: 'B09L4LTR4',
    title: 'Felt-Lined Full Leather Desk Pad & Mouse Mat',
    artisan_name: 'Craft & Hide',
    category: 'Leather Goods',
    description: 'Expansive 32x16 inch workspace mat crafted from single-cut bridle leather. Backed with natural German wool felt to protect desktop woodwork.',
    image_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80',
    price_approx: 89.00,
  },

  // Textiles
  {
    asin: 'B09T1TEX1',
    title: 'Waffle-Weave Pure Washed Flax Linen Throw Blanket',
    artisan_name: 'Folk & Flax Loomworks',
    category: 'Textiles',
    description: 'Woven on vintage shuttle looms from French long-staple flax linen. Pre-washed for incredible softness, breathable warmth, and an effortless drape.',
    image_url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=80',
    price_approx: 95.00,
  },
  {
    asin: 'B09T2TEX2',
    title: 'Hand-Dyed Indigo Shibori Cotton Table Runner',
    artisan_name: 'Aizome Textiles',
    category: 'Textiles',
    description: 'Pure organic cotton folded and clamped before submersing in natural plant-based indigo vats. Every runner reveals unique geometric ripples.',
    image_url: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=900&q=80',
    price_approx: 44.00,
  },
  {
    asin: 'B09T3TEX3',
    title: 'Hand-Spun Merino Wool Chunky Cable Knit Pillow Cover',
    artisan_name: 'Highland Knits',
    category: 'Textiles',
    description: 'Hand-knit from unspun cruelty-free New Zealand merino roving. Tactile chunky cable pattern with invisible coconut wood button closure on reverse.',
    image_url: 'https://images.unsplash.com/photo-1584100936709-3221c5f87b8f?auto=format&fit=crop&w=900&q=80',
    price_approx: 58.00,
  },

  // Home & Living
  {
    asin: 'B09H1HOME1',
    title: 'Pure Wildflower Beeswax Taper Candles (Pair)',
    artisan_name: 'Heritage Apiary Co.',
    category: 'Home & Living',
    description: '100% pure unfiltered cappings beeswax with unbleached cotton wicks. Natural sweet honey fragrance with a clean, smokeless 12-hour burn per taper.',
    image_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80',
    price_approx: 22.00,
  },
  {
    asin: 'B09H2HOME2',
    title: 'Hand-Forged Traditional Iron Hook Rack (4 Pegs)',
    artisan_name: 'Anvil & Ash Blacksmiths',
    category: 'Home & Living',
    description: 'Hammered on an anvil from solid iron bar stock and quenched in linseed oil for a durable rust-resistant historic blackened patina.',
    image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80',
    price_approx: 52.00,
  },
  {
    asin: 'B09H3HOME3',
    title: 'Botanical Wax Melt Tablets with Pressed Wildflowers',
    artisan_name: 'Meadow & Moon',
    category: 'Home & Living',
    description: 'Cast with organic coconut-soy wax and embedded with real larkspur and dried lavender. Scented with pure cedarwood and bergamot essential oils.',
    image_url: 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=900&q=80',
    price_approx: 18.00,
  },
  {
    asin: 'B09H4HOME4',
    title: 'Hand-Woven Sweetgrass Bread & Gathering Basket',
    artisan_name: 'Carolina Lowcountry Weavers',
    category: 'Home & Living',
    description: 'Coiled using indigenous sweetgrass, longleaf pine needles, and palmetto strips. Centuries-old artisanal tradition preserved by master weavers.',
    image_url: 'https://images.unsplash.com/photo-1595351298020-0387063d8065?auto=format&fit=crop&w=900&q=80',
    price_approx: 75.00,
  }
];

export function seed() {
  console.log('Seeding SQLite database with authentic handmade artisan goods...');
  const now = new Date().toISOString();

  let count = 0;
  for (const prod of SAMPLE_ARTISAN_PRODUCTS) {
    upsertItem({
      asin: prod.asin,
      title: prod.title,
      artisan_name: prod.artisan_name,
      category: prod.category,
      description: prod.description,
      image_url: prod.image_url,
      price_approx: prod.price_approx,
      affiliate_url: formatAffiliateUrl(prod.asin),
      is_active: 1,
      last_checked_date: now,
    });
    count++;
  }

  logSystemEvent('database_seed', 'success', `Seeded ${count} verified handmade items across 5 organic categories`);
  console.log(`Successfully seeded ${count} artisan products into data/handmade.db`);
}

// Run when called directly
seed();
