import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { prisma } from '../src/shared/prisma.js'

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
  await prisma.post.deleteMany({ where: { title: { endsWith: run } } })
  await prisma.postCategory.deleteMany({ where: { name: { endsWith: run } } })
  await prisma.product.deleteMany({ where: { name: { endsWith: run } } })
  await prisma.category.deleteMany({ where: { name: { endsWith: run } } })
  await prisma.user.deleteMany({ where: { email: { endsWith: `${run}@tes.local` } } })
  await prisma.$disconnect()
  server.close()
})

test('endpoint admin menolak tamu dan user biasa', async () => {
  assert.equal((await api('/categories', { method: 'POST', body: { name: `X ${run}` } })).status, 401)
  assert.equal((await api('/categories', { method: 'POST', body: { name: `X ${run}` }, cookie: user })).status, 403)
  assert.equal((await api('/auth/me', { cookie: admin })).json.data.role, 'ADMIN')
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

  assert.equal((await api(`/post-categories/${postCategoryId}`, { method: 'DELETE', cookie: admin })).status, 409)
  assert.equal((await api(`/posts/${id}`, { method: 'DELETE', cookie: admin })).status, 200)
  assert.equal((await api(`/post-categories/${postCategoryId}`, { method: 'DELETE', cookie: admin })).status, 200)
})
