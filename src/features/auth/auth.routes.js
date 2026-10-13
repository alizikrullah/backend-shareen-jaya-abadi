import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { authenticateToken } from '../../shared/middlewares/auth.js'
import * as authController from './auth.controller.js'

const email = z.string().trim().toLowerCase().pipe(z.email('Format email tidak valid'))
const name = z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter')

const registerSchema = z.object({
  name,
  email,
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
})
const loginSchema = z.object({ email, password: z.string().min(1, 'Password wajib diisi') })
const updateMeSchema = z.object({ name })

// Batasi percobaan login/register per IP (cegah brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { success: false, message: 'Terlalu banyak percobaan, coba lagi 15 menit lagi' },
})

export const authRoutes = Router()
  .post('/register', authLimiter, validate(registerSchema), authController.register)
  .post('/login', authLimiter, validate(loginSchema), authController.login)
  .post('/logout', authController.logout)
  .get('/me', authenticateToken, authController.getMe)
  .patch('/me', authenticateToken, validate(updateMeSchema), authController.updateMe)
  .get('/google', authController.googleStart)
  .get('/google/callback', authController.googleCallback)
