import { z } from 'zod'

// docs/authentication.md: full name 4-24 chars; password 8-32 chars with at least one
// lowercase, one uppercase, one digit and one special character.
export const nameSchema = z
  .string()
  .trim()
  .min(4, 'Name must be at least 4 characters')
  .max(24, 'Name must be at most 24 characters')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(32, 'Password must be at most 32 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a digit')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character')

export const signupSchema = z.object({
  name: nameSchema,
  email: z.email(),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
})

// Used by the /reset-password form itself, which only renders a password field (the token
// travels via the query string, not the visible form) — see app/pages/reset-password.vue.
export const newPasswordSchema = z.object({
  password: passwordSchema,
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
