import { z } from 'zod'

export const maxCartQuantity = 99

export const cartItemSchema = z.object({
	productId: z.string().trim().min(1).max(64),
	quantity: z.coerce.number().int().min(1).max(maxCartQuantity).default(1),
})

export const cartQuantitySchema = z.object({
	quantity: z.coerce.number().int().min(1).max(maxCartQuantity),
})

// Address is required by the server only when the cart has physical items (checked there).
export const checkoutSchema = z.object({
	addressId: z.string().trim().min(1).max(64).optional(),
})

export type CartItemInput = z.infer<typeof cartItemSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
