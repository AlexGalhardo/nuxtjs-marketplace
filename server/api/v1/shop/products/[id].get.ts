defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'Get one of your products',
	},
})

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}

	const { product } = await requireProductOwner(event, id)
	return product
})
