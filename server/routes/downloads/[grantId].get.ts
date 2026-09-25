import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { downloadQuerySchema } from '#shared/schemas/order'

// GET /downloads/:grantId?expires&signature — streams a private product file (D8). The signature
// proves the link was minted for this grant's buyer; the conditional update both enforces the
// download limit/expiry and counts the download in one statement, so parallel clicks can't overrun it.
export default defineEventHandler(async (event) => {
	const grantId = getRouterParam(event, 'grantId') ?? ''
	const query = downloadQuerySchema.safeParse(getQuery(event))
	if (
		!query.success ||
		!isValidDownloadSignature(grantId, query.data.expires, query.data.signature)
	) {
		throw createError({
			statusCode: 403,
			statusMessage: 'This download link is invalid or expired',
		})
	}

	const [grant] = await db
		.update(schema.downloadGrants)
		.set({ downloadCount: sql`${schema.downloadGrants.downloadCount} + 1` })
		.where(
			and(
				eq(schema.downloadGrants.id, grantId),
				lt(schema.downloadGrants.downloadCount, schema.downloadGrants.maxDownloads),
				gt(schema.downloadGrants.expiresAt, new Date()),
			),
		)
		.returning({ productFileId: schema.downloadGrants.productFileId })
	if (!grant) {
		throw createError({
			statusCode: 410,
			statusMessage: 'This download is no longer available',
		})
	}

	const [file] = await db
		.select()
		.from(schema.productFiles)
		.where(eq(schema.productFiles.id, grant.productFileId))
	if (!file) {
		throw createError({ statusCode: 404, statusMessage: 'File not found' })
	}

	setHeader(
		event,
		'content-disposition',
		`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
	)
	setHeader(event, 'cache-control', 'private, no-store')
	return blob.serve(event, file.blobPath)
})
