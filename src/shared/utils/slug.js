// "Viscose Jacquard Motif Bunga" → "viscose-jacquard-motif-bunga"
export function slugify(text) {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  )
}

// Slug unik untuk sebuah tabel (prisma.product, prisma.post, ...): tambah -2, -3, dst kalau sudah dipakai.
// Slug dibuat sekali saat data dibuat dan tidak berubah saat diedit, supaya link yang sudah dibagikan tetap jalan.
export async function uniqueSlug(table, text) {
  const base = slugify(text)
  const rows = await table.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
  const taken = new Set(rows.map((row) => row.slug))
  let slug = base
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`
  return slug
}
