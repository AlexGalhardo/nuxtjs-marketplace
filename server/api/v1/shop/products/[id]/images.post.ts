import { eq } from 'drizzle-orm'

// POST /api/v1/shop/products/:id/images — multipart upload (form key "files", multiple allowed)
// of public product photos.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  }
  const { product } = await requireProductOwner(event, id)

  const existing = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, product.id))

  const uploaded = await blob.handleUpload(event, {
    formKey: 'files',
    multiple: true,
    ensure: { maxSize: '4MB', types: ['image'] },
    put: { prefix: `images/products/${product.id}`, addRandomSuffix: true },
  })
  if (!uploaded.length) {
    throw createError({ statusCode: 400, statusMessage: 'No files uploaded' })
  }

  const rows = await db
    .insert(schema.productImages)
    .values(
      uploaded.map((file, index) => ({
        productId: product.id,
        blobPath: file.pathname,
        position: existing.length + index,
      })),
    )
    .returning()

  return rows
})
