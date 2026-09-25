// GET /api/cart — the logged-in buyer's cart, grouped by shop and re-priced live (D2).
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	return loadCart(user.id)
})
