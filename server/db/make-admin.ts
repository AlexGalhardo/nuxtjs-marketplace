// `bun run db:make-admin <email>` — promotes an existing account to admin (Phase 11). Admins are
// never created through the app: sign up normally, then run this on the server.
import { eq } from 'drizzle-orm'
import { closeSeedClient, createSeedClient } from './client'

const email = process.argv[2]?.trim()
if (!email) {
	console.error('Usage: bun run db:make-admin <email>')
	process.exit(1)
}

const { db, schema } = await createSeedClient()
const [user] = await db
	.update(schema.users)
	.set({ role: 'admin' })
	.where(eq(schema.users.email, email))
	.returning({ id: schema.users.id })
await closeSeedClient(db)

if (!user) {
	console.error(`No account with email ${email}. Sign up first.`)
	process.exit(1)
}
console.log(`${email} is now an admin.`)
