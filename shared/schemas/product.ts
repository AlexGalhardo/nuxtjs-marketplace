import { z } from 'zod'
import { slugPattern } from './shop'

// `kind` (physical|digital) is not part of this schema: it is derived server-side from the
// selected product type, never trusted from the client (PLAN.md §3.4, products.kind).
export const productSchema = z.object({
  productTypeId: z.string().trim().min(1, 'Select a category'),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug must be at least 3 characters')
    .max(120)
    .regex(slugPattern, 'Use lowercase letters, numbers and hyphens only'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000),
  priceCents: z.coerce.number().int().min(1, 'Price must be at least 1 cent').max(100_000_000),
  shippingCents: z.coerce.number().int().min(0).max(100_000_000).default(0),
  // Only meaningful for physical products; the server nulls it out for digital ones.
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
})

export type ProductInput = z.infer<typeof productSchema>
