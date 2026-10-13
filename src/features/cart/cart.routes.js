import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { authenticateToken } from '../../shared/middlewares/auth.js'
import * as cartController from './cart.controller.js'

// Jumlah dalam meter bulat
const quantity = z.number().int('Jumlah harus meter bulat').min(1, 'Jumlah minimal 1 meter').max(10_000, 'Jumlah terlalu besar')
const addSchema = z.object({ colorId: z.string().min(1, 'Pilih warna'), quantity })
const updateSchema = z.object({ quantity })

export const cartRoutes = Router()
  .get('/cart', authenticateToken, cartController.get)
  .post('/cart', authenticateToken, validate(addSchema), cartController.add)
  .put('/cart/:itemId', authenticateToken, validate(updateSchema), cartController.update)
  .delete('/cart/:itemId', authenticateToken, cartController.remove)
