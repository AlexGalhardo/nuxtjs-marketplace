import { eq } from 'drizzle-orm'
import { addressSchema } from '#shared/schemas/address'

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const body = await readValidatedBody(event, addressSchema.parse)

	if (body.isDefault) {
		await db
			.update(schema.addresses)
			.set({ isDefault: false })
			.where(eq(schema.addresses.userId, user.id))
	}

	const [address] = await db
		.insert(schema.addresses)
		.values({ ...body, userId: user.id })
		.returning()

	return address
})
