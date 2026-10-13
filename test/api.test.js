import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { prisma } from '../src/shared/prisma.js'
import { cancelExpiredOrders } from '../src/features/orders/orders.service.js'

// Tes end-to-end ke database dev + Directus asli: `npm test`.
// Semua data tes diberi penanda `run` lalu dihapus di akhir.
const run = Date.now().toString(36)
const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://localhost:${server.address().port}/api`

async function api(path, { method = 'GET', body, form, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
    body: form ?? (body && JSON.stringify(body)),
  })
  return { status: res.status, json: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] }
}

const password = 'rahasia-tes-123'
const hash = await bcrypt.hash(password, 10)
await prisma.user.createMany({
  data: [
    { name: 'Admin Tes', email: `admin-${run}@tes.local`, password: hash, role: 'ADMIN' },
    { name: 'User Tes', email: `user-${run}@tes.local`, password: hash },
  ],
})
const login = async (email) => (await api('/auth/login', { method: 'POST', body: { email, password } })).cookie
const admin = await login(`admin-${run}@tes.local`)
const user = await login(`user-${run}@tes.local`)

after(async () => {
  const testUsers = { email: { endsWith: `${run}@tes.local` } }
  await prisma.payment.deleteMany({ where: { order: { user: testUsers } } })
  await prisma.orderItem.deleteMany({ where: { order: { user: testUsers } } })
  await prisma.order.deleteMany({ where: { user: testUsers } })
  await prisma.cartItem.deleteMany({ where: { user: testUsers } })
  await prisma.address.deleteMany({ where: { user: testUsers } })
  await prisma.post.deleteMany({ where: { title: { endsWith: run } } })
  await prisma.postCategory.deleteMany({ where: { name: { endsWith: run } } })
  await prisma.product.deleteMany({ where: { name: { endsWith: run } } })
  await prisma.category.deleteMany({ where: { name: { endsWith: run } } })
  await prisma.user.deleteMany({ where: testUsers })
  await prisma.$disconnect()
  server.close()
})

test('endpoint admin menolak tamu dan user biasa', async () => {
  assert.equal((await api('/categories', { method: 'POST', body: { name: `X ${run}` } })).status, 401)
  assert.equal((await api('/categories', { method: 'POST', body: { name: `X ${run}` }, cookie: user })).status, 403)
  assert.equal((await api('/auth/me', { cookie: admin })).json.data.role, 'ADMIN')

  // Daftar user khusus admin, tanpa password/googleId
  assert.equal((await api('/admin/users', { cookie: user })).status, 403)
  const users = (await api(`/admin/users?search=user-${run}`, { cookie: admin })).json.data
  assert.deepEqual(users.map((u) => u.email), [`user-${run}@tes.local`])
  assert.ok(!('password' in users[0]) && !('googleId' in users[0]))
})

test('katalog: kategori, upload, produk, warna, filter', async () => {
  const kategori = await api('/categories', { method: 'POST', cookie: admin, body: { name: `Kain Tes ${run}` } })
  assert.equal(kategori.status, 201)
  assert.equal(kategori.json.data.slug, `kain-tes-${run}`)
  assert.equal((await api('/categories', { method: 'POST', cookie: admin, body: { name: `Kain Tes ${run}` } })).status, 409)
  const kategoriId = kategori.json.data.id

  // Upload gambar ke Directus (PNG 1x1)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const form = new FormData()
  form.append('files', new Blob([png], { type: 'image/png' }), 'tes.png')
  const upload = await api('/admin/uploads', { method: 'POST', cookie: admin, form })
  assert.equal(upload.status, 201)
  const imageUrl = upload.json.data[0].url
  assert.equal((await fetch(imageUrl)).status, 200, 'gambar harus bisa dibuka publik (cek izin Read di policy Public Directus)')

  const txt = new FormData()
  txt.append('files', new Blob(['halo'], { type: 'text/plain' }), 'tes.txt')
  assert.equal((await api('/admin/uploads', { method: 'POST', cookie: admin, form: txt })).status, 400)

  // Validasi produk
  const dasar = { name: `Jacquard Bunga ${run}`, sku: `tes-${run}-a`, price: 85000, weightPerMeter: 300, categoryId: kategoriId }
  const tanpaWarna = await api('/products', { method: 'POST', cookie: admin, body: dasar })
  assert.equal(tanpaWarna.status, 400)
  assert.ok(tanpaWarna.json.errors.colors)
  const gambarLuar = { ...dasar, imageUrls: ['https://contoh.com/a.png'], colors: [{ name: 'Merah', stock: 1 }] }
  assert.equal((await api('/products', { method: 'POST', cookie: admin, body: gambarLuar })).status, 400)

  // Produk A (2 warna) dan B (lebih murah, stok habis)
  const a = await api('/products', {
    method: 'POST',
    cookie: admin,
    body: { ...dasar, imageUrls: [imageUrl], colors: [{ name: 'Merah Marun', hexCode: '#800000', stock: 10 }, { name: 'Biru', stock: 15 }] },
  })
  assert.equal(a.status, 201)
  assert.equal(a.json.data.totalStock, 25)
  assert.equal(a.json.data.sku, `tes-${run}-a`.toUpperCase())
  const skuDobel = { ...dasar, name: `Lain ${run}`, colors: [{ name: 'X', stock: 1 }] }
  assert.equal((await api('/products', { method: 'POST', cookie: admin, body: skuDobel })).status, 409)
  const b = await api('/products', {
    method: 'POST',
    cookie: admin,
    body: { ...dasar, name: `Semiwool Polos ${run}`, sku: `tes-${run}-b`, price: 50000, colors: [{ name: 'Hitam', stock: 0 }] },
  })
  assert.equal(b.json.data.totalStock, 0)
  const [idA, idB] = [a.json.data.id, b.json.data.id]

  // Katalog publik: filter kategori, urut harga, pagination, cari nama
  const urutHarga = await api(`/products?kategori=kain-tes-${run}&sort=harga_asc`)
  assert.deepEqual(urutHarga.json.data.map((p) => p.id), [idB, idA])
  assert.equal(urutHarga.json.meta.total, 2)
  const halaman2 = await api(`/products?kategori=kain-tes-${run}&sort=harga_asc&limit=1&page=2`)
  assert.deepEqual(halaman2.json.data.map((p) => p.id), [idA])
  assert.deepEqual((await api(`/products?search=SEMIWOOL POLOS ${run}`)).json.data.map((p) => p.id), [idB])
  assert.equal((await api('/products?limit=999')).status, 400)

  // Detail publik (slug) & admin (id)
  assert.equal((await api(`/products/${a.json.data.slug}`)).json.data.colors.length, 2)
  assert.equal((await api(`/admin/products/${idA}`, { cookie: admin })).status, 200)

  // Edit tanpa imageUrls ditolak, supaya foto tidak terhapus tanpa sengaja
  assert.equal((await api(`/products/${idA}`, { method: 'PUT', cookie: admin, body: { ...dasar, price: 90000 } })).status, 400)
  assert.equal((await fetch(imageUrl)).status, 200, 'foto masih ada')

  // Edit: harga naik, foto dibuang → file di Directus ikut terhapus, slug tetap
  const edit = await api(`/products/${idA}`, { method: 'PUT', cookie: admin, body: { ...dasar, price: 90000, imageUrls: [] } })
  assert.equal(edit.json.data.price, 90000)
  assert.equal(edit.json.data.slug, a.json.data.slug)
  assert.notEqual((await fetch(imageUrl)).status, 200, 'foto lama harus terhapus dari Directus')

  // Warna
  const hijau = await api(`/products/${idB}/colors`, { method: 'POST', cookie: admin, body: { name: 'Hijau', stock: 5 } })
  assert.equal(hijau.status, 201)
  const hijauUrl = `/products/${idB}/colors/${hijau.json.data.id}`
  assert.equal((await api(hijauUrl, { method: 'PUT', cookie: admin, body: { name: 'Hijau Botol', stock: 7 } })).json.data.stock, 7)
  const salahProduk = `/products/${idA}/colors/${hijau.json.data.id}`
  assert.equal((await api(salahProduk, { method: 'DELETE', cookie: admin })).status, 404, 'warna milik produk lain')
  assert.equal((await api(hijauUrl, { method: 'DELETE', cookie: admin })).status, 200)
  const warnaTerakhir = `/products/${idB}/colors/${b.json.data.colors[0].id}`
  assert.equal((await api(warnaTerakhir, { method: 'DELETE', cookie: admin })).status, 409)

  // Hapus: kategori yang masih dipakai ditolak
  assert.equal((await api(`/categories/${kategoriId}`, { method: 'DELETE', cookie: admin })).status, 409)
  for (const id of [idA, idB]) assert.equal((await api(`/products/${id}`, { method: 'DELETE', cookie: admin })).status, 200)
  assert.equal((await api(`/products/${a.json.data.slug}`)).status, 404)
  assert.equal((await api(`/categories/${kategoriId}`, { method: 'DELETE', cookie: admin })).status, 200)
})

test('blog: draft tidak bocor, publish, isi dibersihkan', async () => {
  const kategori = await api('/post-categories', { method: 'POST', cookie: admin, body: { name: `Tips ${run}` } })
  assert.equal(kategori.status, 201)
  const postCategoryId = kategori.json.data.id

  const draft = await api('/posts', {
    method: 'POST',
    cookie: admin,
    body: {
      title: `Cara Merawat Kain ${run}`,
      content: '<p onclick="alert(1)">Halo</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      postCategoryId,
    },
  })
  assert.equal(draft.status, 201)
  assert.equal(draft.json.data.publishedAt, null)
  assert.ok(!/script|onclick|javascript/.test(draft.json.data.content), draft.json.data.content)

  const { id, slug } = draft.json.data
  const publik = async () => (await api(`/posts?kategori=tips-${run}`)).json.data.map((p) => p.id)
  assert.deepEqual(await publik(), [], 'draft tidak boleh muncul di publik')
  assert.equal((await api(`/posts/${slug}`)).status, 404)
  assert.ok((await api('/admin/posts', { cookie: admin })).json.data.some((p) => p.id === id))

  const terbit = await api(`/posts/${id}`, {
    method: 'PUT',
    cookie: admin,
    body: { title: `Cara Merawat Kain ${run}`, content: '<p>Halo</p>', postCategoryId, published: true },
  })
  assert.ok(terbit.json.data.publishedAt)
  assert.deepEqual(await publik(), [id])
  assert.equal((await api(`/posts/${slug}`)).status, 200)

  // Edit tanpa field published → tetap terbit dengan tanggal terbit yang sama (tidak jadi draft)
  const edit = await api(`/posts/${id}`, {
    method: 'PUT',
    cookie: admin,
    body: { title: `Cara Merawat Kain ${run}`, content: '<p>Edit</p>', postCategoryId },
  })
  assert.equal(edit.json.data.publishedAt, terbit.json.data.publishedAt)

  assert.equal((await api(`/post-categories/${postCategoryId}`, { method: 'DELETE', cookie: admin })).status, 409)
  assert.equal((await api(`/posts/${id}`, { method: 'DELETE', cookie: admin })).status, 200)
  assert.equal((await api(`/post-categories/${postCategoryId}`, { method: 'DELETE', cookie: admin })).status, 200)
})

test('transaksi: alamat, cart, ongkir, checkout, status order', async () => {
  // Produk tes: 2 warna (stok 5 & 3 meter), Rp50.000/m, 300 gram/m
  const kategori = await prisma.category.create({ data: { name: `Checkout ${run}`, slug: `checkout-${run}` } })
  const produk = await prisma.product.create({
    data: {
      name: `Kain Checkout ${run}`,
      slug: `kain-checkout-${run}`,
      sku: `TES-${run}-C`.toUpperCase(),
      price: 50000,
      weightPerMeter: 300,
      categoryId: kategori.id,
      colors: { create: [{ name: 'Merah', stock: 5 }, { name: 'Biru', stock: 3 }] },
    },
    include: { colors: { orderBy: { name: 'asc' } } },
  })
  const [biru, merah] = produk.colors
  const stok = async (id) => (await prisma.productColor.findUnique({ where: { id } })).stock

  // Alamat: wilayah dari RajaOngkir, alamat pertama otomatis default
  const wilayah = await api('/shipping/destinations?search=gambir', { cookie: user })
  assert.ok(wilayah.json.data.length > 0)
  const { label: _, ...area } = wilayah.json.data[0]
  const alamatDasar = { recipient: 'Budi Tes', phone: '081234567890', detail: 'Jl. Tes No. 1', ...area }
  const rumah = await api('/addresses', { method: 'POST', cookie: user, body: { ...alamatDasar, label: 'Rumah' } })
  assert.equal(rumah.status, 201)
  assert.equal(rumah.json.data.isDefault, true)
  const kantor = await api('/addresses', { method: 'POST', cookie: user, body: { ...alamatDasar, label: 'Kantor', isDefault: true } })
  const daftar = (await api('/addresses', { cookie: user })).json.data
  assert.deepEqual(daftar.map((a) => [a.label, a.isDefault]), [['Kantor', true], ['Rumah', false]])
  assert.equal((await api(`/addresses/${rumah.json.data.id}`, { method: 'DELETE', cookie: admin })).status, 404, 'alamat orang lain')
  assert.equal((await api('/addresses', { method: 'POST', cookie: user, body: { ...alamatDasar, label: 'X', phone: '123' } })).status, 400)

  // Cart: warna sama digabung, stok dicek
  assert.equal((await api('/cart', { method: 'POST', cookie: user, body: { colorId: merah.id, quantity: 2 } })).status, 201)
  const gabung = (await api('/cart', { method: 'POST', cookie: user, body: { colorId: merah.id, quantity: 2 } })).json.data
  assert.deepEqual(gabung.items.map((i) => i.quantity), [4])
  assert.equal((await api('/cart', { method: 'POST', cookie: user, body: { colorId: merah.id, quantity: 2 } })).status, 400, 'melebihi stok')
  const keranjang = (await api('/cart', { method: 'POST', cookie: user, body: { colorId: biru.id, quantity: 1 } })).json.data
  assert.equal(keranjang.subtotal, 250000)
  assert.equal(keranjang.totalWeight, 1500)
  const itemBiru = keranjang.items.find((i) => i.colorId === biru.id)
  assert.equal((await api(`/cart/${itemBiru.id}`, { method: 'PUT', cookie: user, body: { quantity: 10 } })).status, 400)
  assert.equal((await api(`/cart/${itemBiru.id}`, { method: 'PUT', cookie: admin, body: { quantity: 1 } })).status, 404, 'cart orang lain')

  // Ongkir dihitung server, checkout pakai layanan termurah
  const ongkir = (await api('/shipping/cost', { method: 'POST', cookie: user, body: { addressId: kantor.json.data.id } })).json.data
  assert.ok(ongkir.length > 0)
  const checkout = { addressId: kantor.json.data.id, courier: ongkir[0].courier, service: ongkir[0].service }
  assert.equal((await api('/orders', { method: 'POST', cookie: user, body: { ...checkout, service: 'NGASAL' } })).status, 400)
  const order = await api('/orders', { method: 'POST', cookie: user, body: checkout })
  assert.equal(order.status, 201, JSON.stringify(order.json))
  assert.equal(order.json.data.totalAmount, 250000 + ongkir[0].cost)
  assert.equal(order.json.data.items.length, 2)
  assert.equal(order.json.data.shippingAddress.recipient, 'Budi Tes')
  assert.equal(order.json.data.items[0].product.slug, `kain-checkout-${run}`)
  assert.equal((await api('/cart', { cookie: user })).json.data.items.length, 0, 'cart kosong setelah checkout')
  assert.deepEqual([await stok(merah.id), await stok(biru.id)], [1, 2], 'stok berkurang')
  assert.equal((await api('/orders', { method: 'POST', cookie: user, body: checkout })).status, 400, 'cart kosong')

  // Akses order
  const orderId = order.json.data.id
  assert.equal((await api(`/orders/${orderId}`, { cookie: user })).status, 200)
  assert.equal((await api(`/orders/${orderId}`, { cookie: admin })).status, 404, 'order orang lain')
  assert.equal((await api(`/admin/orders/${orderId}`, { cookie: admin })).json.data.user.email, `user-${run}@tes.local`)
  assert.equal((await api('/admin/stats', { cookie: admin })).status, 200)

  // Admin: transisi salah ditolak, batal → stok kembali
  const statusUrl = `/admin/orders/${orderId}/status`
  assert.equal((await api(statusUrl, { method: 'PATCH', cookie: admin, body: { status: 'SHIPPED', trackingNumber: 'RESI123' } })).status, 400)
  assert.equal((await api(statusUrl, { method: 'PATCH', cookie: admin, body: { status: 'CANCELLED' } })).json.data.status, 'CANCELLED')
  assert.deepEqual([await stok(merah.id), await stok(biru.id)], [5, 3], 'stok kembali setelah batal')

  // Auto-cancel: order PENDING yang lewat 24 jam
  await api('/cart', { method: 'POST', cookie: user, body: { colorId: merah.id, quantity: 1 } })
  const lama = (await api('/orders', { method: 'POST', cookie: user, body: checkout })).json.data
  await prisma.order.update({ where: { id: lama.id }, data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } })
  assert.ok((await cancelExpiredOrders()) >= 1)
  assert.equal((await api(`/orders/${lama.id}`, { cookie: user })).json.data.status, 'CANCELLED')
  assert.equal(await stok(merah.id), 5)
})

test('pembayaran Midtrans', { skip: !process.env.MIDTRANS_SERVER_KEY && 'MIDTRANS_SERVER_KEY belum diisi' }, async () => {
  const warna = await prisma.productColor.findFirst({ where: { name: 'Merah', product: { name: `Kain Checkout ${run}` } } })
  const alamat = (await api('/addresses', { cookie: user })).json.data[0]
  await api('/cart', { method: 'POST', cookie: user, body: { colorId: warna.id, quantity: 2 } })
  const [termurah] = (await api('/shipping/cost', { method: 'POST', cookie: user, body: { addressId: alamat.id } })).json.data
  const checkout = { addressId: alamat.id, courier: termurah.courier, service: termurah.service }
  const order = (await api('/orders', { method: 'POST', cookie: user, body: checkout })).json.data

  // Snap token dibuat sekali lalu dipakai ulang ("bayar ulang")
  const token = await api('/payment/token', { method: 'POST', cookie: user, body: { orderId: order.id } })
  assert.equal(token.status, 200, JSON.stringify(token.json))
  assert.equal((await api('/payment/token', { method: 'POST', cookie: user, body: { orderId: order.id } })).json.data.token, token.json.data.token)

  // Cek status ke API Midtrans: belum pilih metode bayar → transaksi belum ada → tetap PENDING
  const cek = await api('/payment/status', { method: 'POST', cookie: user, body: { orderId: order.id } })
  assert.equal(cek.status, 200, JSON.stringify(cek.json))
  assert.equal(cek.json.data.status, 'PENDING')
  assert.equal((await api('/payment/status', { method: 'POST', cookie: admin, body: { orderId: order.id } })).status, 404, 'order orang lain')

  // Webhook: signature palsu ditolak, settlement → PROCESSING, notifikasi dobel tetap aman
  const notif = (transaction_status) => {
    const body = { order_id: order.id, status_code: '200', gross_amount: `${order.totalAmount}.00`, transaction_status, payment_type: 'bank_transfer' }
    body.signature_key = createHash('sha512')
      .update(body.order_id + body.status_code + body.gross_amount + process.env.MIDTRANS_SERVER_KEY)
      .digest('hex')
    return body
  }
  assert.equal((await api('/payment/notification', { method: 'POST', body: { ...notif('settlement'), signature_key: 'palsu' } })).status, 403)
  for (const _ of [1, 2]) assert.equal((await api('/payment/notification', { method: 'POST', body: notif('settlement') })).status, 200)
  const lunas = (await api(`/orders/${order.id}`, { cookie: user })).json.data
  assert.equal(lunas.status, 'PROCESSING')
  assert.equal(lunas.payment.status, 'PAID')
  assert.equal((await api('/payment/status', { method: 'POST', cookie: user, body: { orderId: order.id } })).json.data.status, 'PROCESSING')

  // Admin: kirim wajib resi, lalu selesai
  const statusUrl = `/admin/orders/${order.id}/status`
  assert.equal((await api(statusUrl, { method: 'PATCH', cookie: admin, body: { status: 'SHIPPED' } })).status, 400)
  const dikirim = await api(statusUrl, { method: 'PATCH', cookie: admin, body: { status: 'SHIPPED', trackingNumber: 'JNE123456' } })
  assert.equal(dikirim.json.data.trackingNumber, 'JNE123456')
  assert.equal((await api(statusUrl, { method: 'PATCH', cookie: admin, body: { status: 'COMPLETED' } })).json.data.status, 'COMPLETED')
})
