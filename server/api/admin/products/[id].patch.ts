import { eq } from 'drizzle-orm'
import { productModerationSchema } from '#shared/schemas/admin'

// PATCH /api/admin/products/:id { status, reason } — `suspended` takes a listing down (sellers
// can't republish it); `archived` reinstates it as unpublished, and the seller republishes.
export default defineEventHandler(async (event) => {
	const admin = await requireAdmin(event)
	const id = getRouterParam(event, 'id') ?? ''
	const { status, reason } = await readValidatedBody(event, productModerationSchema.parse)
	const [product] = await db
		.select({ id: schema.products.id, status: schema.products.status })
		.from(schema.products)
		.where(eq(schema.products.id, id))
	if (!product) {
		throw createError({ statusCode: 404, statusMessage: 'Product not found' })
	}
	const suspending = status === 'suspended'
	if (suspending === (product.status === 'suspended')) {
		throw createError({
			statusCode: 409,
			statusMessage: suspending ? 'Product is already suspended' : 'Product is not suspended',
		})
	}
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(schema.products)
			.set({ status })
			.where(eq(schema.products.id, id))
			.returning({ id: schema.products.id, status: schema.products.status })
		await logAudit(
			{
				actorId: admin.id,
				action: suspending ? 'product.suspended' : 'product.reinstated',
				targetType: 'product',
				targetId: id,
				metadata: { reason, from: product.status },
			},
			tx,
		)
		return updated
	})
})
