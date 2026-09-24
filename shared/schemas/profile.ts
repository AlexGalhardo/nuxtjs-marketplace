import { z } from 'zod'
import { nameSchema, passwordSchema } from './auth'

export const updateProfileSchema = z.object({
	name: nameSchema,
	phone: z.string().trim().max(30).optional(),
})

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Current password is required'),
	newPassword: passwordSchema,
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
