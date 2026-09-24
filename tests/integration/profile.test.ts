import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

interface AddressResponse {
  id: string
  fullName: string
  isDefault: boolean
}

function uniqueEmail() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function extractSessionCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('Expected a Set-Cookie header')
  return setCookie.split(';')[0] as string
}

async function signUpAndGetCookie(email: string) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Profile Test', email, password: 'Ab1!Ab1!' }),
    headers: { 'content-type': 'application/json' },
  })
  return extractSessionCookie(response)
}

const address = {
  fullName: 'Alex Vieira',
  line1: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  postalCode: '62704',
  country: 'US',
  phone: '+1 555-0100',
}

describe('profile endpoints', () => {
  it('rejects unauthenticated access', async () => {
    const response = await fetch('/api/profile')
    expect(response.status).toBe(401)
  })

  it('reads and updates the profile, refreshing the session', async () => {
    const cookie = await signUpAndGetCookie(uniqueEmail())

    const before = await $fetch<{ user: { name: string } }>('/api/profile', { headers: { cookie } })
    expect(before.user.name).toBe('Profile Test')

    const patchResponse = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', phone: '+1 555-0199' }),
    })
    expect(patchResponse.status).toBe(200)
    const updated = (await patchResponse.json()) as { user: { name: string }; phone: string | null }
    expect(updated.user.name).toBe('Updated Name')
    expect(updated.phone).toBe('+1 555-0199')

    // The PATCH sets a fresh session cookie (name changed) — use it, not the stale signup one.
    const refreshedCookie = extractSessionCookie(patchResponse)
    const me = await $fetch<{ user: { name: string } }>('/api/auth/me', {
      headers: { cookie: refreshedCookie },
    })
    expect(me.user.name).toBe('Updated Name')
  })

  it('rejects a password change with the wrong current password, and invalidates the session on success', async () => {
    const cookie = await signUpAndGetCookie(uniqueEmail())

    const wrongCurrent = await fetch('/api/profile/password', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'WrongPass1!', newPassword: 'NewPass1!' }),
    })
    expect(wrongCurrent.status).toBe(401)

    const success = await fetch('/api/profile/password', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'Ab1!Ab1!', newPassword: 'NewPass1!' }),
    })
    expect(success.status).toBe(200)

    const meAfter = await fetch('/api/auth/me', { headers: { cookie } })
    expect(meAfter.status).toBe(401)
  })

  it('creates, lists, updates and deletes addresses, enforcing a single default', async () => {
    const cookie = await signUpAndGetCookie(uniqueEmail())

    const first = await $fetch<AddressResponse>('/api/profile/addresses', {
      method: 'POST',
      headers: { cookie },
      body: { ...address, isDefault: true },
    })
    const second = await $fetch<AddressResponse>('/api/profile/addresses', {
      method: 'POST',
      headers: { cookie },
      body: { ...address, fullName: 'Second Address', isDefault: true },
    })

    const list = await $fetch<AddressResponse[]>('/api/profile/addresses', { headers: { cookie } })
    expect(list).toHaveLength(2)
    const firstAfter = list.find((a) => a.id === first.id)
    expect(firstAfter?.isDefault).toBe(false)
    expect(list.find((a) => a.id === second.id)?.isDefault).toBe(true)

    await $fetch(`/api/profile/addresses/${first.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { ...address, fullName: 'Renamed', isDefault: false },
    })
    const afterRename = await $fetch<AddressResponse[]>('/api/profile/addresses', {
      headers: { cookie },
    })
    expect(afterRename.find((a) => a.id === first.id)?.fullName).toBe('Renamed')

    const deleteResponse = await fetch(`/api/profile/addresses/${first.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(deleteResponse.status).toBe(200)
    const afterDelete = await $fetch<AddressResponse[]>('/api/profile/addresses', {
      headers: { cookie },
    })
    expect(afterDelete).toHaveLength(1)
  })

  it("returns 404 when acting on another user's address", async () => {
    const cookieA = await signUpAndGetCookie(uniqueEmail())
    const cookieB = await signUpAndGetCookie(uniqueEmail())

    const owned = await $fetch<AddressResponse>('/api/profile/addresses', {
      method: 'POST',
      headers: { cookie: cookieA },
      body: address,
    })

    const patchAttempt = await fetch(`/api/profile/addresses/${owned.id}`, {
      method: 'PATCH',
      headers: { cookie: cookieB, 'content-type': 'application/json' },
      body: JSON.stringify(address),
    })
    expect(patchAttempt.status).toBe(404)

    const deleteAttempt = await fetch(`/api/profile/addresses/${owned.id}`, {
      method: 'DELETE',
      headers: { cookie: cookieB },
    })
    expect(deleteAttempt.status).toBe(404)
  })
})
