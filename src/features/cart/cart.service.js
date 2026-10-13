import { prisma } from '../../shared/prisma.js'
import { HttpError } from '../../shared/utils/httpError.js'

const productSelect = { id: true, name: true, slug: true, sku: true, price: true, weightPerMeter: true, imageUrls: true }
const itemInclude = {
  color: { select: { id: true, name: true, hexCode: true, stock: true, product: { select: productSelect } } },
}

// Isi cart + subtotal (Rupiah) + totalWeight (gram). Dipakai juga oleh hitung ongkir & checkout;
// `db` bisa diisi transaction supaya checkout membaca data terbaru di dalam transaction.
export async function getCart(userId, db = prisma) {
  const items = await db.cartItem.findMany({ where: { userId }, include: itemInclude, orderBy: { createdAt: 'asc' } })
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.color.product.price * item.quantity, 0),
    totalWeight: items.reduce((sum, item) => sum + item.color.product.weightPerMeter * item.quantity, 0),
  }
}

function checkStock(color, quantity) {
  if (quantity > color.stock) {
    throw new HttpError(400, `Stok ${color.product.name} warna ${color.name} tinggal ${color.stock} meter`)
  }
}

export async function add(userId, { colorId, quantity }) {
  const color = await prisma.productColor.findUnique({ where: { id: colorId }, include: { product: { select: { name: true } } } })
  if (!color) throw new HttpError(404, 'Warna produk tidak ditemukan')

  // Warna yang sama sudah ada di cart → jumlahnya ditambah, bukan baris baru
  const key = { userId_colorId: { userId, colorId } }
  const existing = await prisma.cartItem.findUnique({ where: key })
  const total = (existing?.quantity ?? 0) + quantity
  checkStock(color, total)

  await prisma.cartItem.upsert({ where: key, create: { userId, colorId, quantity }, update: { quantity: total } })
  return getCart(userId)
}

export async function update(userId, itemId, { quantity }) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, userId },
    include: { color: { include: { product: { select: { name: true } } } } },
  })
  if (!item) throw new HttpError(404, 'Item keranjang tidak ditemukan')
  checkStock(item.color, quantity)

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } })
  return getCart(userId)
}

export async function remove(userId, itemId) {
  await prisma.cartItem.delete({ where: { id: itemId, userId } })
  return getCart(userId)
}
