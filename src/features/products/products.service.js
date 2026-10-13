import { prisma } from '../../shared/prisma.js'
import { HttpError } from '../../shared/utils/httpError.js'
import { uniqueSlug } from '../../shared/utils/slug.js'
import { toSkipTake } from '../../shared/utils/pagination.js'
import { removeFromDirectus } from '../../shared/utils/directus.js'

const colorSelect = { id: true, name: true, hexCode: true, stock: true }
const include = {
  category: { select: { id: true, name: true, slug: true } },
  colors: { select: colorSelect, orderBy: { name: 'asc' } },
}

// ponytail: "terlaris" = berapa kali produk masuk order (termasuk order batal). Ganti ke SUM quantity
// dari order yang sudah dibayar (raw SQL) kalau datanya sudah banyak.
const sortOptions = {
  terbaru: [{ createdAt: 'desc' }, { id: 'asc' }],
  terlaris: [{ orderItems: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'asc' }],
  harga_asc: [{ price: 'asc' }, { id: 'asc' }],
  harga_desc: [{ price: 'desc' }, { id: 'asc' }],
}

// Stok produk = jumlah stok semua warnanya (dihitung, tidak disimpan)
const withTotalStock = (product) => ({
  ...product,
  totalStock: product.colors.reduce((sum, color) => sum + color.stock, 0),
})

function productError(err) {
  if (err.code === 'P2002') return new HttpError(409, 'SKU sudah dipakai produk lain')
  if (err.code === 'P2003') return new HttpError(400, 'Kategori tidak ditemukan')
  return err
}

export async function list({ kategori, search, sort, ...page }) {
  const where = {
    ...(kategori && { category: { slug: kategori } }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  }
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include, omit: { description: true }, orderBy: sortOptions[sort], ...toSkipTake(page) }),
    prisma.product.count({ where }),
  ])
  return { items: products.map(withTotalStock), meta: { ...page, total } }
}

export async function getOne(where) {
  const product = await prisma.product.findUnique({ where, include })
  if (!product) throw new HttpError(404, 'Produk tidak ditemukan')
  return withTotalStock(product)
}

export async function create({ colors, ...data }) {
  try {
    const product = await prisma.product.create({
      data: { ...data, slug: await uniqueSlug(prisma.product, data.name), colors: { create: colors } },
      include,
    })
    return withTotalStock(product)
  } catch (err) {
    throw productError(err)
  }
}

export async function update(id, data) {
  const old = await prisma.product.findUnique({ where: { id }, select: { imageUrls: true } })
  if (!old) throw new HttpError(404, 'Produk tidak ditemukan')

  let product
  try {
    product = await prisma.product.update({ where: { id }, data, include })
  } catch (err) {
    throw productError(err)
  }
  // Foto yang dibuang dari produk ikut dihapus dari Directus
  await removeFromDirectus(old.imageUrls.filter((url) => !data.imageUrls.includes(url)))
  return withTotalStock(product)
}

export async function remove(id) {
  const product = await prisma.product.delete({ where: { id } })
  await removeFromDirectus(product.imageUrls)
}

export async function addColor(productId, data) {
  try {
    return await prisma.productColor.create({ data: { ...data, productId }, select: colorSelect })
  } catch (err) {
    if (err.code === 'P2003') throw new HttpError(404, 'Produk tidak ditemukan')
    throw err
  }
}

// where pakai productId juga, jadi warna milik produk lain tidak bisa diubah/dihapus lewat URL produk ini
export const updateColor = (productId, colorId, data) =>
  prisma.productColor.update({ where: { id: colorId, productId }, data, select: colorSelect })

export async function removeColor(productId, colorId) {
  const count = await prisma.productColor.count({ where: { productId } })
  if (count === 1) throw new HttpError(409, 'Produk minimal punya satu warna')
  await prisma.productColor.delete({ where: { id: colorId, productId } })
}
