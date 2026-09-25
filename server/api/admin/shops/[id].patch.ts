import { eq } from 'drizzle-orm'
import { shopModerationSchema } from '#shared/schemas/admin'

// PATCH /api/admin/shops/:id { status, reason } — suspend or reinstate a shop. A suspended shop
// vanishes from the catalog, cart and checkout at once (publicProductConditions, D12); its
// products keep their own status, so reinstating brings them back as they were.
export default defineEventHandler(async (event) => {
	const admin = await requireAdmin(event)
	const id = getRouterParam(event, 'id') ?? ''
	const { status, reason } = await readValidatedBody(event, shopModerationSchema.parse)
	const [shop] = await db
		.select({ id: schema.shops.id, status: schema.shops.status, ownerId: schema.shops.ownerId })
		.from(schema.shops)
		.where(eq(schema.shops.id, id))
	if (!shop) {
		throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
	}
	if (shop.status === status) {
		throw createError({ statusCode: 409, statusMessage: `Shop is already ${status}` })
	}
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(schema.shops)
			.set({ status })
			.where(eq(schema.shops.id, id))
			.returning({ id: schema.shops.id, status: schema.shops.status })
		await logAudit(
			{
				actorId: admin.id,
				action: status === 'suspended' ? 'shop.suspended' : 'shop.reinstated',
				targetType: 'shop',
				targetId: id,
				metadata: { reason, from: shop.status, ownerId: shop.ownerId },
			},
			tx,
		)
		return updated
	})
})
