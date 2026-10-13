import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { authenticateToken } from '../../shared/middlewares/auth.js'
import * as paymentController from './payment.controller.js'

const tokenSchema = z.object({ orderId: z.string().min(1, 'Order wajib dipilih') })

export const paymentRoutes = Router()
  .post('/payment/token', authenticateToken, validate(tokenSchema), paymentController.token)
  // Dipanggil server Midtrans (tanpa login) — keasliannya dicek lewat signature_key
  .post('/payment/notification', paymentController.notification)
