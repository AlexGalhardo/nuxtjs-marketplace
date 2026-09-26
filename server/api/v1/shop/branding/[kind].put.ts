import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['shop'],
		summary: 'Upload the shop logo or banner',
		description:
			'`kind` is `logo` or `banner`. Multipart form with one `file` image (JPEG, PNG, WebP or GIF).',
	},
})

// PUT /api/v1/shop/branding/logo or /banner — multipart upload (form key "file") of the
// shop's public branding image.
//
// Validates and uploads the file manually (not via blob.handleUpload()) because that helper
// wraps ensureBlob()'s 400 validation error in a generic 500 "Storage error" (@nuxthub/core@0.10.8,
// blob/lib/storage.mjs) — sellers need a real 400 when they pick an oversized or non-image file.
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

	const form = await readFormData(event)
	const file = form.get('file')
	if (!(file instanceof File)) {
		throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
	}
	ensureBlob(file, { maxSize: '4MB', types: ['image'] })

	const uploaded = await blob.put(blobFileName(file.name), file, {
		prefix: `images/shops/${shop.id}/${kind}`,
		addRandomSuffix: true,
	})

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
