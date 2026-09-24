// UUIDv7 primary keys (time-ordered, index-friendly) via Bun's native generator.
export function newId(): string {
  return Bun.randomUUIDv7()
}
