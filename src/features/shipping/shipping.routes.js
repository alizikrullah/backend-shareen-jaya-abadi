import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { authenticateToken } from '../../shared/middlewares/auth.js'
import * as shippingController from './shipping.controller.js'

// Kuota RajaOngkir terbatas per hari — batasi request per IP
const quotaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: { success: false, message: 'Terlalu banyak permintaan ongkir, coba lagi beberapa menit lagi' },
})

const costSchema = z.object({ addressId: z.string().min(1, 'Pilih alamat pengiriman') })

export const shippingRoutes = Router()
  .get('/shipping/destinations', authenticateToken, quotaLimiter, shippingController.destinations)
  .post('/shipping/cost', authenticateToken, quotaLimiter, validate(costSchema), shippingController.cost)
