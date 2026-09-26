defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'Upload digital product files',
		description:
			'Multipart form, one or more `files`. Private: buyers only get signed download links.',
	},
})

// POST /api/v1/shop/products/:id/files — multipart upload (form key "files", multiple allowed)
// of the private digital files delivered to buyers after purchase (D8/D9: never publicly
// routable; served only through signed download grants, added in Phase 9).
//
// Uploads directly via blob.put() (not blob.handleUpload()) so the original filename — shown to
// buyers at download time — is preserved separately from the randomized storage pathname.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}
	const { product } = await requireProductOwner(event, id)
	if (product.kind !== 'digital') {
		throw createError({ statusCode: 400, statusMessage: 'Only digital products accept files' })
	}

	const form = await readFormData(event)
	const files = form.getAll('files').filter((entry): entry is File => entry instanceof File)
	if (!files.length) {
		throw createError({ statusCode: 400, statusMessage: 'No files uploaded' })
	}
	for (const file of files) {
		ensureBlob(file, { maxSize: '512MB' })
	}

	const rows = []
	for (const file of files) {
		const object = await blob.put(blobFileName(file.name), file, {
			access: 'private',
			prefix: `files/products/${product.id}`,
			addRandomSuffix: true,
		})
		const [row] = await db
			.insert(schema.productFiles)
			.values({
				productId: product.id,
				blobPath: object.pathname,
				filename: file.name,
				size: file.size,
				contentType: file.type || 'application/octet-stream',
			})
			.returning()
		rows.push(row)
	}

	return rows
})
