import { z } from 'zod'

export const shipSellerOrderSchema = z.object({
	carrier: z.string().trim().min(1, 'Enter the carrier').max(60),
	trackingCode: z.string().trim().min(1, 'Enter the tracking code').max(100),
})

export const reviewSchema = z.object({
	orderItemId: z.string().trim().min(1).max(64),
	rating: z.coerce.number().int().min(1, 'Pick a rating').max(5),
	comment: z.string().trim().max(1000).optional(),
})

export const downloadQuerySchema = z.object({
	expires: z.coerce.number().int().positive(),
	signature: z.string().regex(/^[0-9a-f]{64}$/),
})

export type ShipSellerOrderInput = z.infer<typeof shipSellerOrderSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
