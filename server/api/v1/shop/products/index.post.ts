import { eq } from 'drizzle-orm'
import { productSchema } from '#shared/schemas/product'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, productSchema.parse)

  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, user.id))
  if (!shop) {
    throw createError({ statusCode: 404, statusMessage: 'Create a shop before adding products' })
  }

  const [productType] = await db
    .select()
    .from(schema.productTypes)
    .where(eq(schema.productTypes.id, body.productTypeId))
  if (!productType) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown category' })
  }

  const [existingSlug] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.slug, body.slug))
  if (existingSlug) {
    throw createError({ statusCode: 409, statusMessage: 'This product URL is already taken' })
  }

  const [product] = await db
    .insert(schema.products)
    .values({
      shopId: shop.id,
      productTypeId: productType.id,
      kind: productType.kind,
      title: body.title,
      slug: body.slug,
      description: body.description,
      priceCents: body.priceCents,
      shippingCents: productType.kind === 'physical' ? body.shippingCents : 0,
      stock: productType.kind === 'physical' ? (body.stock ?? 0) : null,
    })
    .returning()

  return product
})
