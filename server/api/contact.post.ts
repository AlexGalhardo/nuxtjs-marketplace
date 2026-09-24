import { contactSchema } from '#shared/schemas/contact'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, contactSchema.parse)

  await db.insert(schema.contactMessages).values(body)

  const config = useRuntimeConfig()
  if (config.contactEmail) {
    await sendMail({
      to: config.contactEmail,
      subject: `[Contact] ${body.subject}`,
      text: `From: ${body.name} <${body.email}>\n\n${body.message}`,
    })
  }

  return { success: true }
})
