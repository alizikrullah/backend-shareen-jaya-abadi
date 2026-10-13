import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { adminOnly } from '../../shared/middlewares/auth.js'
import { directusImageUrl } from '../../shared/utils/directus.js'
import * as productsController from './products.controller.js'

const colorSchema = z.object({
  name: z.string().trim().min(1, 'Nama warna wajib diisi').max(50, 'Nama warna maksimal 50 karakter'),
  hexCode: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Kode warna harus format #RRGGBB').nullish(),
  stock: z.number().int().min(0, 'Stok tidak boleh minus'),
})

const productFields = {
  name: z.string().trim().min(2, 'Nama produk minimal 2 karakter').max(150, 'Nama produk maksimal 150 karakter'),
  sku: z.string().trim().toUpperCase().min(1, 'SKU wajib diisi').max(50, 'SKU maksimal 50 karakter'),
  description: z.string().trim().max(5000, 'Deskripsi maksimal 5000 karakter').nullish(),
  price: z.number().int().positive('Harga harus lebih dari 0'),
  weightPerMeter: z.number().int().positive('Berat per meter harus lebih dari 0'),
  imageUrls: z.array(directusImageUrl).max(10, 'Maksimal 10 foto').default([]),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
}

// Saat dibuat, produk wajib punya minimal satu warna. Setelah itu warna diatur lewat endpoint warna.
const createProductSchema = z.object({ ...productFields, colors: z.array(colorSchema).min(1, 'Minimal satu warna') })
// Saat edit, imageUrls wajib dikirim — kalau dibiarkan default [], semua foto produk ikut terhapus
const updateProductSchema = z.object({ ...productFields, imageUrls: z.array(directusImageUrl).max(10, 'Maksimal 10 foto') })

export const productsRoutes = Router()
  .get('/products', productsController.list)
  .get('/products/:slug', productsController.getBySlug)
  .get('/admin/products/:id', adminOnly, productsController.getById)
  .post('/products', adminOnly, validate(createProductSchema), productsController.create)
  .put('/products/:id', adminOnly, validate(updateProductSchema), productsController.update)
  .delete('/products/:id', adminOnly, productsController.remove)
  .post('/products/:productId/colors', adminOnly, validate(colorSchema), productsController.addColor)
  .put('/products/:productId/colors/:colorId', adminOnly, validate(colorSchema), productsController.updateColor)
  .delete('/products/:productId/colors/:colorId', adminOnly, productsController.removeColor)
