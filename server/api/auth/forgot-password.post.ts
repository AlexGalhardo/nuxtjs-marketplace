import { eq } from 'drizzle-orm'
import { forgotPasswordSchema } from '#shared/schemas/auth'

const ONE_HOUR_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, forgotPasswordSchema.parse)

	const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
	logSecurityEvent(event, 'password_reset.requested', { userId: user?.id ?? null })
	if (user) {
		const token = generateToken()
		await db.insert(schema.passwordResetTokens).values({
			userId: user.id,
			tokenHash: hashToken(token),
			expiresAt: new Date(Date.now() + ONE_HOUR_MS),
		})

		const config = useRuntimeConfig()
		const resetUrl = `${config.public.siteUrl}/reset-password?token=${token}`
		// Not awaited, and a mail outage never reaches the response: otherwise known emails would answer
		// slower, or with an error, than unknown ones (user enumeration).
		queueMail({
			to: user.email,
			subject: 'Reset your password',
			text: `We received a request to reset your password.\n\nReset it here: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
		}).catch((error: unknown) => console.error('[auth] reset email failed', error))
	}

	// Always 200, whether or not the email exists: no user enumeration (docs/authentication.md).
	return { success: true }
})
