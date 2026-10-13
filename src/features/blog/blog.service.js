import sanitizeHtml from 'sanitize-html'
import { prisma } from '../../shared/prisma.js'
import { HttpError } from '../../shared/utils/httpError.js'
import { uniqueSlug } from '../../shared/utils/slug.js'
import { toSkipTake } from '../../shared/utils/pagination.js'
import { removeFromDirectus } from '../../shared/utils/directus.js'

// Tag & atribut yang boleh ada di isi artikel. Sisanya (script, iframe, onclick, style, javascript:) dibuang.
const sanitizeOptions = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) },
}

const include = { postCategory: { select: { id: true, name: true, slug: true } } }
const publishedWhere = () => ({ publishedAt: { not: null, lte: new Date() } })

function postError(err) {
  if (err.code === 'P2003') return new HttpError(400, 'Kategori blog tidak ditemukan')
  return err
}

function categoryError(err) {
  if (err.code === 'P2002') return new HttpError(409, 'Nama kategori sudah ada')
  if (err.code === 'P2003') return new HttpError(409, 'Kategori masih dipakai artikel, pindahkan atau hapus artikelnya dulu')
  return err
}

export async function listPublished({ kategori, ...page }) {
  const where = { ...publishedWhere(), ...(kategori && { postCategory: { slug: kategori } }) }
  const [items, total] = await prisma.$transaction([
    prisma.post.findMany({ where, include, omit: { content: true }, orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }], ...toSkipTake(page) }),
    prisma.post.count({ where }),
  ])
  return { items, meta: { ...page, total } }
}

export async function getPublished(slug) {
  const post = await prisma.post.findFirst({ where: { slug, ...publishedWhere() }, include })
  if (!post) throw new HttpError(404, 'Artikel tidak ditemukan')
  return post
}

// Admin: semua artikel termasuk draft
export async function listAll(page) {
  const [items, total] = await prisma.$transaction([
    prisma.post.findMany({ include, omit: { content: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], ...toSkipTake(page) }),
    prisma.post.count(),
  ])
  return { items, meta: { ...page, total } }
}

export async function getById(id) {
  const post = await prisma.post.findUnique({ where: { id }, include })
  if (!post) throw new HttpError(404, 'Artikel tidak ditemukan')
  return post
}

export async function create({ published, content, ...data }) {
  try {
    return await prisma.post.create({
      data: {
        ...data,
        content: sanitizeHtml(content, sanitizeOptions),
        slug: await uniqueSlug(prisma.post, data.title),
        publishedAt: published ? new Date() : null,
      },
      include,
    })
  } catch (err) {
    throw postError(err)
  }
}

export async function update(id, { published, content, ...data }) {
  const old = await prisma.post.findUnique({ where: { id }, select: { publishedAt: true, thumbnailUrl: true } })
  if (!old) throw new HttpError(404, 'Artikel tidak ditemukan')

  let post
  try {
    post = await prisma.post.update({
      where: { id },
      data: {
        ...data,
        content: sanitizeHtml(content, sanitizeOptions),
        // published tidak dikirim → tidak berubah. Artikel yang sudah terbit tetap pakai tanggal terbit pertamanya.
        publishedAt: published === undefined ? undefined : published ? (old.publishedAt ?? new Date()) : null,
      },
      include,
    })
  } catch (err) {
    throw postError(err)
  }
  if (old.thumbnailUrl !== post.thumbnailUrl) await removeFromDirectus([old.thumbnailUrl])
  return post
}

export async function remove(id) {
  const post = await prisma.post.delete({ where: { id } })
  await removeFromDirectus([post.thumbnailUrl])
}

export const listCategories = () =>
  prisma.postCategory.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { posts: true } } } })

export async function createCategory({ name }) {
  try {
    return await prisma.postCategory.create({ data: { name, slug: await uniqueSlug(prisma.postCategory, name) } })
  } catch (err) {
    throw categoryError(err)
  }
}

export async function updateCategory(id, { name }) {
  try {
    return await prisma.postCategory.update({ where: { id }, data: { name } })
  } catch (err) {
    throw categoryError(err)
  }
}

export async function removeCategory(id) {
  try {
    await prisma.postCategory.delete({ where: { id } })
  } catch (err) {
    throw categoryError(err)
  }
}
