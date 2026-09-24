import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const fileId = getRouterParam(event, 'fileId')
  if (!id || !fileId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing product or file id' })
  }
  const { product } = await requireProductOwner(event, id)

  const [file] = await db
    .select()
    .from(schema.productFiles)
    .where(and(eq(schema.productFiles.id, fileId), eq(schema.productFiles.productId, product.id)))
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  await db.delete(schema.productFiles).where(eq(schema.productFiles.id, file.id))
  await blob.del(file.blobPath).catch(() => {})

  return { success: true }
})
