import { prisma } from '../../shared/prisma.js'
import { HttpError } from '../../shared/utils/httpError.js'
import { toSkipTake } from '../../shared/utils/pagination.js'
import { getShippingOptions } from '../../shared/utils/rajaongkir.js'
import { getCart } from '../cart/cart.service.js'
import { getOwned } from '../addresses/addresses.service.js'

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']
const PENDING_LIMIT_MS = 24 * 60 * 60 * 1000 // samakan dengan expiry Snap Midtrans

const include = { items: true, payment: { select: { status: true, method: true, paidAt: true } } }
const adminInclude = { ...include, user: { select: { id: true, name: true, email: true } } }

// Transisi yang boleh dilakukan admin (lihat "Alur Status Order" di PRD)
const adminTransitions = { PENDING: 'CANCELLED', PROCESSING: 'SHIPPED', SHIPPED: 'COMPLETED' }

export async function checkout(userId, { addressId, courier, service }) {
  const address = await getOwned(userId, addressId)
  const { items, totalWeight } = await getCart(userId)
  if (!items.length) throw new HttpError(400, 'Keranjang masih kosong')

  // Ongkir selalu dihitung ulang di server — angka dari client tidak dipercaya
  const options = await getShippingOptions(address.destinationId, totalWeight)
  const shipping = options.find((option) => option.courier === courier && option.service === service)
  if (!shipping) throw new HttpError(400, 'Layanan kurir tidak tersedia untuk alamat ini')

  const { id, userId: _, isDefault, createdAt, ...shippingAddress } = address

  return prisma.$transaction(async (tx) => {
    // Baca ulang cart di dalam transaction, jadi harga & stok yang dipakai adalah yang terbaru
    const cart = await getCart(userId, tx)
    if (cart.totalWeight !== totalWeight) throw new HttpError(409, 'Isi keranjang berubah, silakan cek ulang')

    for (const item of cart.items) {
      // Stok hanya dikurangi kalau masih cukup — cegah stok minus saat dua orang checkout bersamaan
      const { count } = await tx.productColor.updateMany({
        where: { id: item.colorId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      })
      if (!count) throw new HttpError(409, `Stok ${item.color.product.name} warna ${item.color.name} tidak cukup`)
    }

    const order = await tx.order.create({
      data: {
        userId,
        shippingAddress,
        courier: shipping.courier,
        courierService: shipping.service,
        shippingCost: shipping.cost,
        subtotal: cart.subtotal,
        totalAmount: cart.subtotal + shipping.cost,
        // Snapshot: riwayat order tidak ikut berubah kalau produk/warna diedit atau dihapus
        items: {
          create: cart.items.map((item) => ({
            productId: item.color.product.id,
            colorId: item.colorId,
            productName: item.color.product.name,
            sku: item.color.product.sku,
            colorName: item.color.name,
            quantity: item.quantity,
            price: item.color.product.price,
          })),
        },
      },
      include,
    })
    await tx.cartItem.deleteMany({ where: { userId } })
    return order
  })
}

// Batalkan order yang masih PENDING + kembalikan stok. Aman dipanggil berkali-kali
// (webhook Midtrans bisa datang dobel, auto-cancel dan admin bisa bersamaan).
export async function cancelPendingOrder(tx, orderId) {
  const { count } = await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } })
  if (!count) return false

  const items = await tx.orderItem.findMany({ where: { orderId, colorId: { not: null } } })
  for (const item of items) {
    await tx.productColor.update({ where: { id: item.colorId }, data: { stock: { increment: item.quantity } } })
  }
  await tx.payment.updateMany({ where: { orderId }, data: { status: 'FAILED' } })
  return true
}

// ponytail: dijalankan pakai setInterval di server.js (satu proses). Pindah ke cron/queue kalau BE jalan lebih dari 1 instance.
export async function cancelExpiredOrders() {
  const expired = await prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - PENDING_LIMIT_MS) } },
    select: { id: true },
  })
  for (const { id } of expired) await prisma.$transaction((tx) => cancelPendingOrder(tx, id))
  return expired.length
}

export async function listMine(userId, page) {
  const where = { userId }
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...toSkipTake(page) }),
    prisma.order.count({ where }),
  ])
  return { items, meta: { ...page, total } }
}

export async function getMine(userId, id) {
  const order = await prisma.order.findFirst({ where: { id, userId }, include })
  if (!order) throw new HttpError(404, 'Order tidak ditemukan')
  return order
}

export async function listAll({ status, ...page }) {
  const where = status ? { status } : {}
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({ where, include: adminInclude, orderBy: { createdAt: 'desc' }, ...toSkipTake(page) }),
    prisma.order.count({ where }),
  ])
  return { items, meta: { ...page, total } }
}

export async function getAny(id) {
  const order = await prisma.order.findUnique({ where: { id }, include: adminInclude })
  if (!order) throw new HttpError(404, 'Order tidak ditemukan')
  return order
}

export async function updateStatus(id, { status, trackingNumber }) {
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } })
  if (!order) throw new HttpError(404, 'Order tidak ditemukan')
  if (adminTransitions[order.status] !== status) {
    throw new HttpError(400, `Status ${order.status} tidak bisa diubah ke ${status}`)
  }
  if (status === 'SHIPPED' && !trackingNumber) throw new HttpError(400, 'Nomor resi wajib diisi saat barang dikirim')

  const changed =
    status === 'CANCELLED'
      ? await prisma.$transaction((tx) => cancelPendingOrder(tx, id))
      : (
          await prisma.order.updateMany({
            where: { id, status: order.status },
            data: { status, ...(status === 'SHIPPED' && { trackingNumber }) },
          })
        ).count > 0
  if (!changed) throw new HttpError(409, 'Status order sudah berubah, muat ulang halaman')
  return getAny(id)
}

export async function stats() {
  const [counts, latest] = await prisma.$transaction([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    prisma.order.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ])
  const perStatus = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, counts.find((row) => row.status === status)?._count._all ?? 0]),
  )
  return { perStatus, latest }
}
