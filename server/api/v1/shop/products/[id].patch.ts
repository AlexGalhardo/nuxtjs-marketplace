import { eq } from 'drizzle-orm'
import { productSchema } from '#shared/schemas/product'

// Slug is immutable after creation (like shops); this schema omits it.
const updateSchema = productSchema.omit({ slug: true })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  }

  const { product } = await requireProductOwner(event, id)
  const body = await readValidatedBody(event, updateSchema.parse)

  const [productType] = await db
    .select()
    .from(schema.productTypes)
    .where(eq(schema.productTypes.id, body.productTypeId))
  if (!productType) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown category' })
  }

  const [updated] = await db
    .update(schema.products)
    .set({
      productTypeId: productType.id,
      kind: productType.kind,
      title: body.title,
      description: body.description,
      priceCents: body.priceCents,
      shippingCents: productType.kind === 'physical' ? body.shippingCents : 0,
      stock: productType.kind === 'physical' ? (body.stock ?? product.stock ?? 0) : null,
    })
    .where(eq(schema.products.id, product.id))
    .returning()

  return updated
})
