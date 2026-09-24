import { eq } from 'drizzle-orm'

// POST /api/v1/shop/products/:id/images — multipart upload (form key "files", multiple allowed)
// of public product photos.
//
// Validates and uploads files manually (not via blob.handleUpload()) because that helper wraps
// ensureBlob()'s 400 validation error in a generic 500 "Storage error" (@nuxthub/core@0.10.8,
// blob/lib/storage.mjs) — sellers need a real 400 when they pick an oversized or non-image file.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  }
  const { product } = await requireProductOwner(event, id)

  const form = await readFormData(event)
  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File)
  if (!files.length) {
    throw createError({ statusCode: 400, statusMessage: 'No files uploaded' })
  }
  for (const file of files) {
    ensureBlob(file, { maxSize: '4MB', types: ['image'] })
  }

  const existing = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, product.id))

  const rows = []
  for (const [index, file] of files.entries()) {
    const object = await blob.put(file.name, file, {
      prefix: `images/products/${product.id}`,
      addRandomSuffix: true,
    })
    const [row] = await db
      .insert(schema.productImages)
      .values({
        productId: product.id,
        blobPath: object.pathname,
        position: existing.length + index,
      })
      .returning()
    rows.push(row)
  }

  return rows
})
