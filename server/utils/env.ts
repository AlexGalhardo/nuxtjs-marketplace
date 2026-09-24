import { z } from 'zod'

// Nitro's runtime env merge (unjs `destr`) auto-parses a numeric-looking env var value into a
// JS number before it reaches this schema, so a purely numeric secret (e.g. a placeholder Stripe
// key) would otherwise fail as "expected string, received number". Coerce back to a string.
const optionalString = z.coerce.string().trim().default('')

export const runtimeEnvSchema = z.object({
  strictEnv: z.stringbool().or(z.boolean()).default(true),
  platformFeeBps: z.coerce.number().int().min(0).max(10_000),
  contactEmail: z.union([z.literal(''), z.email()]),
  stripe: z.object({
    secretKey: optionalString,
    webhookSecret: optionalString,
  }),
  resend: z.object({ apiKey: optionalString }),
  email: z.object({ from: optionalString }),
  session: z.object({
    password: z.string().refine((value) => value === '' || value.length >= 32, {
      message: 'must be at least 32 characters',
    }),
  }),
  public: z.object({
    siteUrl: z.url(),
    stripe: z.object({ publishableKey: optionalString }),
  }),
})

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>

// Secrets that must exist before the app can serve real traffic
const productionRequired = [
  ['stripe.secretKey', (env: RuntimeEnv) => env.stripe.secretKey],
  ['stripe.webhookSecret', (env: RuntimeEnv) => env.stripe.webhookSecret],
  ['public.stripe.publishableKey', (env: RuntimeEnv) => env.public.stripe.publishableKey],
  ['session.password', (env: RuntimeEnv) => env.session.password],
] as const

export interface EnvValidationResult {
  errors: string[]
  warnings: string[]
}

export function validateRuntimeEnv(config: unknown, strict: boolean): EnvValidationResult {
  const parsed = runtimeEnvSchema.safeParse(config)
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      warnings: [],
    }
  }

  const missing = productionRequired
    .filter(([, read]) => !read(parsed.data))
    .map(([key]) => `${key} is not set`)

  return strict ? { errors: missing, warnings: [] } : { errors: [], warnings: missing }
}
