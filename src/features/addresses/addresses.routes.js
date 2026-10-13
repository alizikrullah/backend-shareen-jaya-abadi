import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { authenticateToken } from '../../shared/middlewares/auth.js'
import * as addressesController from './addresses.controller.js'

// Field wilayah (destinationId s/d postalCode) diisi dari hasil GET /api/shipping/destinations
const addressSchema = z.object({
  label: z.string().trim().min(1, 'Label wajib diisi').max(30, 'Label maksimal 30 karakter'),
  recipient: z.string().trim().min(2, 'Nama penerima minimal 2 karakter').max(100, 'Nama penerima maksimal 100 karakter'),
  phone: z.string().trim().regex(/^(\+62|62|0)8\d{7,11}$/, 'Nomor HP tidak valid, contoh: 081234567890'),
  destinationId: z.string().trim().min(1, 'Pilih wilayah tujuan'),
  province: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  subdistrict: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'Kode pos harus 5 angka'),
  detail: z.string().trim().min(5, 'Alamat lengkap minimal 5 karakter').max(300, 'Alamat lengkap maksimal 300 karakter'),
  isDefault: z.boolean().optional(),
})

export const addressesRoutes = Router()
  .get('/addresses', authenticateToken, addressesController.list)
  .post('/addresses', authenticateToken, validate(addressSchema), addressesController.create)
  .put('/addresses/:id', authenticateToken, validate(addressSchema), addressesController.update)
  .delete('/addresses/:id', authenticateToken, addressesController.remove)
  .patch('/addresses/:id/default', authenticateToken, addressesController.setDefault)
