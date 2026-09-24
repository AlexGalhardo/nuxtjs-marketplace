import { z } from 'zod'

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const shopSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(60)
    .regex(slugPattern, 'Use lowercase letters, numbers and hyphens only'),
  description: z.string().trim().max(2000).optional(),
})

// Slugs are immutable after creation (they can already be linked to). Settings only edits
// name/description.
export const shopUpdateSchema = shopSchema.omit({ slug: true })

export type ShopInput = z.infer<typeof shopSchema>
export type ShopUpdateInput = z.infer<typeof shopUpdateSchema>
