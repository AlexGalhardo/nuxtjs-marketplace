import { eq } from 'drizzle-orm'

// PUT /api/v1/shop/branding/logo or /banner — multipart upload (form key "file") of the
// shop's public branding image.
export default defineEventHandler(async (event) => {
  const kind = getRouterParam(event, 'kind')
  if (kind !== 'logo' && kind !== 'banner') {
    throw createError({ statusCode: 400, statusMessage: 'Kind must be "logo" or "banner"' })
  }

  const user = await requireUser(event)
  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, user.id))
  if (!shop) {
    throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
  }

  const [uploaded] = await blob.handleUpload(event, {
    formKey: 'file',
    multiple: false,
    ensure: { maxSize: '4MB', types: ['image'] },
    put: { prefix: `images/shops/${shop.id}/${kind}`, addRandomSuffix: true },
  })
  if (!uploaded) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const previousPath = kind === 'logo' ? shop.logoPath : shop.bannerPath
  const [updated] =
    kind === 'logo'
      ? await db
          .update(schema.shops)
          .set({ logoPath: uploaded.pathname })
          .where(eq(schema.shops.id, shop.id))
          .returning()
      : await db
          .update(schema.shops)
          .set({ bannerPath: uploaded.pathname })
          .where(eq(schema.shops.id, shop.id))
          .returning()

  if (previousPath) {
    await blob.del(previousPath).catch(() => {})
  }

  return updated
})
