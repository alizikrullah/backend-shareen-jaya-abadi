import crypto from 'node:crypto'
import { prisma } from '../../shared/prisma.js'
import { env } from '../../shared/config/env.js'
import { HttpError } from '../../shared/utils/httpError.js'
import { cancelPendingOrder, getMine, PENDING_LIMIT_MS } from '../orders/orders.service.js'

const SNAP_URL = env.midtrans.isProduction
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
const API_URL = env.midtrans.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'

// Format waktu Midtrans dalam WIB: "2026-10-13 15:07:00 +0700"
const toMidtransTime = (date) =>
  `${new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)} +0700`

function requireServerKey() {
  if (!env.midtrans.serverKey) throw new HttpError(503, 'Pembayaran belum dikonfigurasi')
  return env.midtrans.serverKey
}

const basicAuth = () => `Basic ${Buffer.from(`${requireServerKey()}:`).toString('base64')}`

export async function createToken(userId, orderId) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true, payment: true, user: true } })
  if (!order) throw new HttpError(404, 'Order tidak ditemukan')
  if (order.status !== 'PENDING') throw new HttpError(400, 'Order ini tidak sedang menunggu pembayaran')

  // Token Snap berlaku sampai order expired (24 jam) — dipakai ulang untuk "bayar ulang"
  if (order.payment?.snapToken) return { token: order.payment.snapToken }

  const res = await fetch(SNAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: basicAuth(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: order.id, gross_amount: order.totalAmount },
      // Total item_details wajib sama dengan gross_amount, jadi ongkir ikut jadi satu baris
      item_details: [
        ...order.items.map((item) => ({
          id: item.sku,
          name: `${item.productName} - ${item.colorName}`.slice(0, 50),
          price: item.price,
          quantity: item.quantity,
        })),
        { id: 'ONGKIR', name: `Ongkir ${order.courier.toUpperCase()} ${order.courierService}`.slice(0, 50), price: order.shippingCost, quantity: 1 },
      ],
      customer_details: { first_name: order.user.name, email: order.user.email, phone: order.shippingAddress.phone },
      // Batas bayar dihitung dari waktu ORDER dibuat (bukan saat token dibuat), sama persis dengan auto-cancel.
      // Kalau tidak, user bisa membayar order yang sudah dibatalkan otomatis.
      expiry: { start_time: toMidtransTime(order.createdAt), unit: 'minute', duration: PENDING_LIMIT_MS / 60_000 },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Midtrans Snap gagal:', res.status, body)
    throw new HttpError(502, 'Gagal membuat pembayaran, coba lagi')
  }

  await prisma.payment.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, snapToken: body.token },
    update: { snapToken: body.token },
  })
  return { token: body.token }
}

function isValidSignature({ order_id, status_code, gross_amount, signature_key }) {
  const expected = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${requireServerKey()}`)
    .digest('hex')
  return (
    typeof signature_key === 'string' &&
    signature_key.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature_key), Buffer.from(expected))
  )
}

// Webhook Midtrans. Status → aksi mengikuti "Alur Status Order" di PRD. Idempotent: notifikasi dobel tidak mengubah apa-apa.
export async function handleNotification(notification) {
  if (!isValidSignature(notification)) throw new HttpError(403, 'Signature tidak valid')

  const order = await prisma.order.findUnique({ where: { id: notification.order_id } })
  if (!order) throw new HttpError(404, 'Order tidak ditemukan')
  if (Number(notification.gross_amount) !== order.totalAmount) throw new HttpError(400, 'Nominal pembayaran tidak cocok')
  await applyStatus(order, notification)
}

// Cek status langsung ke API Midtrans — cadangan kalau webhook belum/tidak masuk
// (termasuk saat development tanpa URL publik). Data diambil sendiri dari Midtrans, jadi tidak perlu cek signature.
export async function syncStatus(userId, orderId) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } })
  if (!order) throw new HttpError(404, 'Order tidak ditemukan')

  if (order.status === 'PENDING') {
    const res = await fetch(`${API_URL}/v2/${order.id}/status`, { headers: { Accept: 'application/json', Authorization: basicAuth() } })
    const transaction = await res.json().catch(() => ({}))
    // status_code 404 = pembeli belum memilih metode bayar, jadi transaksinya belum ada
    if (res.ok && transaction.status_code !== '404' && Number(transaction.gross_amount) === order.totalAmount) {
      await applyStatus(order, transaction)
    }
  }
  return getMine(userId, orderId)
}

// Terapkan status transaksi Midtrans ke order. Dipakai webhook & cek status manual; aman dipanggil berkali-kali.
async function applyStatus(order, { transaction_status: status, fraud_status: fraud, payment_type: method }) {
  const orderId = order.id
  if (status === 'settlement' || (status === 'capture' && fraud === 'accept')) {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'PROCESSING' } })
      if (!count) {
        if (order.status === 'CANCELLED') console.error(`Pembayaran masuk untuk order ${orderId} yang sudah batal — perlu refund manual`)
        return
      }
      const paid = { status: 'PAID', method, paidAt: new Date() }
      await tx.payment.upsert({ where: { orderId }, create: { orderId, ...paid }, update: paid })
    })
  } else if (['cancel', 'deny', 'expire'].includes(status)) {
    await prisma.$transaction((tx) => cancelPendingOrder(tx, orderId))
  } else if (status === 'refund' || status === 'partial_refund') {
    // Refund dilakukan dari dashboard Midtrans; stok tidak dikembalikan otomatis
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } }),
      prisma.payment.updateMany({ where: { orderId }, data: { status: 'REFUNDED' } }),
    ])
  }
  // Status lain (pending, capture + challenge) → tunggu notifikasi berikutnya
}
