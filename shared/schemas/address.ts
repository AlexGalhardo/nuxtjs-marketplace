import { z } from 'zod'

export const addressSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z
    .string()
    .trim()
    .length(2, 'Use a 2-letter country code (ISO 3166-1 alpha-2)')
    .toUpperCase(),
  phone: z.string().trim().min(1, 'Phone is required').max(30),
  isDefault: z.boolean().default(false),
})

export type AddressInput = z.infer<typeof addressSchema>
