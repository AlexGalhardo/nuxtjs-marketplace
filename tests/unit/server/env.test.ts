import { describe, expect, it } from 'vitest'
import { validateRuntimeEnv } from '../../../server/utils/env'

const baseConfig = {
  platformFeeBps: 1000,
  contactEmail: '',
  stripe: { secretKey: '', webhookSecret: '' },
  resend: { apiKey: '' },
  email: { from: '' },
  session: { password: '' },
  public: { siteUrl: 'http://localhost:3000', stripe: { publishableKey: '' } },
}

const withStripe = {
  ...baseConfig,
  stripe: { secretKey: 'sk_test_123', webhookSecret: 'whsec_123' },
  session: { password: 'a'.repeat(32) },
  public: { ...baseConfig.public, stripe: { publishableKey: 'pk_test_123' } },
}

describe('validateRuntimeEnv', () => {
  it('treats NUXT_STRICT_ENV strings as booleans', () => {
    expect(validateRuntimeEnv({ ...baseConfig, strictEnv: 'false' }, false).errors).toEqual([])
  })

  it('accepts the default config in non-strict mode and only warns about missing secrets', () => {
    const result = validateRuntimeEnv(baseConfig, false)

    expect(result.errors).toEqual([])
    expect(result.warnings).toHaveLength(4)
  })

  it('fails in strict mode when required secrets are missing', () => {
    const result = validateRuntimeEnv(baseConfig, true)

    expect(result.errors).toEqual([
      'stripe.secretKey is not set',
      'stripe.webhookSecret is not set',
      'public.stripe.publishableKey is not set',
      'session.password is not set',
    ])
  })

  it('rejects a session password shorter than 32 characters', () => {
    const result = validateRuntimeEnv({ ...withStripe, session: { password: 'too-short' } }, true)

    expect(result.errors[0]).toMatch(/^session\.password:/)
  })

  it('passes in strict mode when every required secret is set', () => {
    expect(validateRuntimeEnv(withStripe, true)).toEqual({ errors: [], warnings: [] })
  })

  it('coerces the platform fee from an env string', () => {
    expect(validateRuntimeEnv({ ...withStripe, platformFeeBps: '250' }, true).errors).toEqual([])
  })

  it.each([-1, 10_001, 1.5, 'abc'])('rejects an invalid platform fee (%s)', (platformFeeBps) => {
    const result = validateRuntimeEnv({ ...baseConfig, platformFeeBps }, false)

    expect(result.errors[0]).toMatch(/^platformFeeBps:/)
  })

  it("coerces a numeric env value back to a string (Nitro's destr-based env merge can turn a purely numeric secret into a number)", () => {
    const result = validateRuntimeEnv(
      { ...withStripe, stripe: { secretKey: 123456, webhookSecret: 'whsec_123' } },
      true,
    )

    expect(result.errors).toEqual([])
  })

  it('rejects an invalid site URL and contact email', () => {
    const result = validateRuntimeEnv(
      {
        ...baseConfig,
        contactEmail: 'not-an-email',
        public: { ...baseConfig.public, siteUrl: 'localhost' },
      },
      false,
    )

    expect(result.errors).toHaveLength(2)
  })
})
