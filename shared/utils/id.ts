import { randomBytes } from 'node:crypto'

// UUIDv7 (RFC 9562): 48-bit millisecond timestamp + version/variant bits + random tail.
// Implemented directly on node:crypto (not Bun.randomUUIDv7()) so id generation is identical
// under Bun and Node — @nuxt/test-utils always spawns the built server via `node`, even though
// the real deploy runtime is Bun (infra/docker/Dockerfile), and a Bun-only global broke there.
//
// Uses Math.floor division instead of BigInt shifts: Date.now() is an exact integer far inside
// the 53-bit safe range, so `Math.floor(ms / 2 ** n)` equals the true integer right-shift with no
// precision loss, and `& 0xff` still extracts the correct low byte even once that intermediate
// value exceeds 32 bits (JS's bitwise ops reduce modulo 2**32 first, which preserves it).
export function newId(): string {
	const bytes = randomBytes(16)
	const ms = Date.now()

	bytes[0] = Math.floor(ms / 2 ** 40) & 0xff
	bytes[1] = Math.floor(ms / 2 ** 32) & 0xff
	bytes[2] = Math.floor(ms / 2 ** 24) & 0xff
	bytes[3] = Math.floor(ms / 2 ** 16) & 0xff
	bytes[4] = Math.floor(ms / 2 ** 8) & 0xff
	bytes[5] = ms & 0xff

	bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6) // version 7
	bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8) // variant 10

	const hex = bytes.toString('hex')
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
