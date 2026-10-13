import { prisma } from '../../shared/prisma.js'
import { HttpError } from '../../shared/utils/httpError.js'
import { uniqueSlug } from '../../shared/utils/slug.js'

function categoryError(err) {
  if (err.code === 'P2002') return new HttpError(409, 'Nama kategori sudah ada')
  if (err.code === 'P2003') return new HttpError(409, 'Kategori masih dipakai produk, pindahkan atau hapus produknya dulu')
  return err
}

export const list = () =>
  prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } })

export async function create({ name }) {
  try {
    return await prisma.category.create({ data: { name, slug: await uniqueSlug(prisma.category, name) } })
  } catch (err) {
    throw categoryError(err)
  }
}

export async function update(id, { name }) {
  try {
    return await prisma.category.update({ where: { id }, data: { name } })
  } catch (err) {
    throw categoryError(err)
  }
}

export async function remove(id) {
  try {
    await prisma.category.delete({ where: { id } })
  } catch (err) {
    throw categoryError(err)
  }
}
