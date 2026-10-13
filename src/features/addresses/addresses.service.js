import { prisma } from '../../shared/prisma.js'
import { HttpError } from '../../shared/utils/httpError.js'

// Semua query di sini difilter userId, jadi user tidak bisa menyentuh alamat milik orang lain

export const list = (userId) =>
  prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })

export async function getOwned(userId, id) {
  const address = await prisma.address.findFirst({ where: { id, userId } })
  if (!address) throw new HttpError(404, 'Alamat tidak ditemukan')
  return address
}

export async function setDefault(userId, id) {
  return prisma.$transaction(async (tx) => {
    await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.update({ where: { id, userId }, data: { isDefault: true } })
  })
}

export async function create(userId, { isDefault, ...data }) {
  // Alamat pertama otomatis jadi default
  const isFirst = (await prisma.address.count({ where: { userId } })) === 0
  const address = await prisma.address.create({ data: { ...data, userId, isDefault: isFirst } })
  return isDefault && !isFirst ? setDefault(userId, address.id) : address
}

export async function update(userId, id, { isDefault, ...data }) {
  const address = await prisma.address.update({ where: { id, userId }, data })
  return isDefault ? setDefault(userId, id) : address
}

export async function remove(userId, id) {
  const address = await prisma.address.delete({ where: { id, userId } })
  if (!address.isDefault) return
  // Alamat default dihapus → alamat terbaru yang tersisa jadi default
  const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
  if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
}
