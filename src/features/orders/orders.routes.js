import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { authenticateToken, adminOnly } from '../../shared/middlewares/auth.js'
import * as ordersController from './orders.controller.js'

// courier & service dipilih dari hasil POST /api/shipping/cost — ongkirnya dihitung ulang di server
const checkoutSchema = z.object({
  addressId: z.string().min(1, 'Pilih alamat pengiriman'),
  courier: z.string().min(1, 'Pilih kurir'),
  service: z.string().min(1, 'Pilih layanan kurir'),
})

const statusSchema = z.object({
  status: z.enum(['CANCELLED', 'SHIPPED', 'COMPLETED']),
  trackingNumber: z.string().trim().min(3, 'Nomor resi minimal 3 karakter').max(50, 'Nomor resi maksimal 50 karakter').optional(),
})

export const ordersRoutes = Router()
  .post('/orders', authenticateToken, validate(checkoutSchema), ordersController.checkout)
  .get('/orders', authenticateToken, ordersController.listMine)
  .get('/orders/:id', authenticateToken, ordersController.getMine)
  .get('/admin/orders', adminOnly, ordersController.listAll)
  .get('/admin/orders/:id', adminOnly, ordersController.getAny)
  .patch('/admin/orders/:id/status', adminOnly, validate(statusSchema), ordersController.updateStatus)
  .get('/admin/stats', adminOnly, ordersController.stats)
