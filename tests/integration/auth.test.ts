import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { issueResetToken } from './helpers/reset-token'

interface MeResponse {
  user: { id: string; name: string; email: string; role: string }
}

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function extractSessionCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('Expected a Set-Cookie header')
  return setCookie.split(';')[0] as string
}

describe('auth flows', () => {
  // @nuxt/test-utils' built server dynamic-imports each route's chunk lazily on first request.
  // Reset-password is otherwise requested only once, near the end of this file's long run, and
  // that very first hit intermittently threw a transient ENOENT before the chunk resolved (never
  // reproduced outside this harness: manual dev/prod-build testing and a standalone
  // loadNuxt+buildNuxt reproduction all succeeded reliably). Touching the route once here, while
  // the server is fresh, avoids it — every later call in this file is then reliable.
  it('warms up the reset-password route before it is exercised for real below', async () => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'warmup', password: 'Ab1!Ab1!' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(400)
  })

  it('signs up, rejects a duplicate email, and exposes the session via /api/auth/me', async () => {
    const email = uniqueEmail()
    const signupResponse = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test User', email, password: 'Ab1!Ab1!' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(signupResponse.status).toBe(200)
    const cookie = extractSessionCookie(signupResponse)

    const me = await $fetch<MeResponse>('/api/auth/me', { headers: { cookie } })
    expect(me.user.email).toBe(email)
    expect(me.user.role).toBe('user')

    const duplicate = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test User', email, password: 'Ab1!Ab1!' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(duplicate.status).toBe(409)
  })

  it('rejects login with the same generic message for a wrong password and an unknown email', async () => {
    const email = uniqueEmail()
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Test User', email, password: 'Ab1!Ab1!' },
    })

    const wrongPassword = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'WrongPass1!' }),
      headers: { 'content-type': 'application/json' },
    })
    const unknownEmail = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail(), password: 'WrongPass1!' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    const [wrongBody, unknownBody] = await Promise.all([wrongPassword.json(), unknownEmail.json()])
    expect(wrongBody.statusMessage).toBe(unknownBody.statusMessage)
  })

  it('logs in, then logout clears the session', async () => {
    const email = uniqueEmail()
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Test User', email, password: 'Ab1!Ab1!' },
    })

    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Ab1!Ab1!' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(loginResponse.status).toBe(200)
    const cookie = extractSessionCookie(loginResponse)

    const logoutResponse = await fetch('/api/auth/logout', { method: 'POST', headers: { cookie } })
    expect(logoutResponse.status).toBe(200)

    const meAfterLogout = await fetch('/api/auth/me', {
      headers: { cookie: extractSessionCookie(logoutResponse) },
    })
    expect(meAfterLogout.status).toBe(401)
  })

  it('always returns success for forgot-password, whether or not the email exists', async () => {
    const existing = uniqueEmail()
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Test User', email: existing, password: 'Ab1!Ab1!' },
    })

    const forExisting = await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: existing },
    })
    const forUnknown = await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: uniqueEmail() },
    })

    expect(forExisting).toEqual({ success: true })
    expect(forUnknown).toEqual({ success: true })
  })

  it('resets the password with a valid single-use token and invalidates the previous session', async () => {
    const email = uniqueEmail()
    const signupResponse = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test User', email, password: 'Ab1!Ab1!' }),
      headers: { 'content-type': 'application/json' },
    })
    const oldCookie = extractSessionCookie(signupResponse)
    const { user } = await $fetch<MeResponse>('/api/auth/me', { headers: { cookie: oldCookie } })

    const rawToken = issueResetToken(user.id)

    const resetResponse = await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: rawToken, password: 'NewPass1!' },
    })
    expect(resetResponse).toEqual({ success: true })

    const meWithOldCookie = await fetch('/api/auth/me', { headers: { cookie: oldCookie } })
    expect(meWithOldCookie.status).toBe(401)

    const loginOldPassword = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Ab1!Ab1!' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(loginOldPassword.status).toBe(401)

    const loginNewPassword = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'NewPass1!' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(loginNewPassword.status).toBe(200)

    const reuseResponse = await fetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: rawToken, password: 'AnotherPass1!' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(reuseResponse.status).toBe(400)
  })
})
