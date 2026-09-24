import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({ alt: z.string().trim().max(200) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const imageId = getRouterParam(event, 'imageId')
  if (!id || !imageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing product or image id' })
  }
  const { product } = await requireProductOwner(event, id)
  const body = await readValidatedBody(event, bodySchema.parse)

  const [updated] = await db
    .update(schema.productImages)
    .set({ alt: body.alt })
    .where(
      and(eq(schema.productImages.id, imageId), eq(schema.productImages.productId, product.id)),
    )
    .returning()
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  }

  return updated
})
