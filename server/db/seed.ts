// Idempotent seed: safe to run repeatedly (setups/*.sh call it on every run). See docs/database.md.
import { closeSeedClient, createSeedClient } from './client'

// Fixed list (D13, PLAN.md §3.4): filters stay clean because every product picks one of these.
const productTypes = [
  { slug: 'electronics', name: 'Electronics', kind: 'physical' as const },
  { slug: 'clothing-apparel', name: 'Clothing & Apparel', kind: 'physical' as const },
  { slug: 'home-kitchen', name: 'Home & Kitchen', kind: 'physical' as const },
  { slug: 'books', name: 'Books', kind: 'physical' as const },
  { slug: 'toys-games', name: 'Toys & Games', kind: 'physical' as const },
  { slug: 'sports-outdoors', name: 'Sports & Outdoors', kind: 'physical' as const },
  { slug: 'ebooks', name: 'E-books', kind: 'digital' as const },
  { slug: 'software-apps', name: 'Software & Apps', kind: 'digital' as const },
  { slug: 'online-courses', name: 'Online Courses', kind: 'digital' as const },
  { slug: 'digital-art-design', name: 'Digital Art & Design', kind: 'digital' as const },
  { slug: 'music-audio', name: 'Music & Audio', kind: 'digital' as const },
  { slug: 'templates-themes', name: 'Templates & Themes', kind: 'digital' as const },
]

async function main() {
  const { db, dialect, schema } = await createSeedClient()
  console.log(`Seeding ${dialect} database...`)

  for (const productType of productTypes) {
    await db.insert(schema.productTypes).values(productType).onConflictDoNothing()
  }
  console.log(`Seeded ${productTypes.length} product types.`)

  // Admin user and demo shops/products are seeded starting Phase 4: users.password_hash
  // requires nuxt-auth-utils' scrypt hashing, which isn't installed yet (see PLAN.md Phase 3).

  await closeSeedClient(db)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
