// Static public routes only for now. Phase 7 (marketplace/products/shops) extends this with
// entries generated from the DB.
const staticPaths = ['/', '/contact', '/terms', '/privacy', '/login', '/signup']

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl.replace(/\/$/, '')

  const urls = staticPaths.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
})
