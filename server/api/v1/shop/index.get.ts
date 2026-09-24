import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, user.id))
  if (shop) return shop

  // H3 treats a literal `null` return as "send 204 No Content" (handleHandlerResponse), which
  // ofetch/$fetch then parses back as `undefined`, not `null` — breaking the documented
  // `Shop | null` contract. Sending the JSON text "null" explicitly keeps the response a real,
  // parseable `null` body.
  return send(event, 'null', 'application/json')
})
