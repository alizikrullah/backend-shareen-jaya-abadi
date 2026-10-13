import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { z } from 'zod'
import { env } from './shared/config/env.js'
import { passport } from './shared/config/passport.js'
import { authRoutes } from './features/auth/auth.routes.js'
import { categoriesRoutes } from './features/categories/categories.routes.js'
import { productsRoutes } from './features/products/products.routes.js'
import { blogRoutes } from './features/blog/blog.routes.js'
import { uploadsRoutes } from './features/uploads/uploads.routes.js'
import { addressesRoutes } from './features/addresses/addresses.routes.js'
import { shippingRoutes } from './features/shipping/shipping.routes.js'
import { cartRoutes } from './features/cart/cart.routes.js'
import { ordersRoutes } from './features/orders/orders.routes.js'
import { paymentRoutes } from './features/payment/payment.routes.js'
import { usersRoutes } from './features/users/users.routes.js'
import { notFound, errorHandler } from './shared/middlewares/errorHandler.js'

z.config(z.locales.id()) // pesan validasi bawaan Zod dalam Bahasa Indonesia

export const app = express()
app.disable('x-powered-by') // jangan umumkan "Express" di header response

// ponytail: percaya 1 proxy (Traefik di Coolify) supaya IP asli & cookie secure terbaca benar.
// Naikkan angkanya kalau nanti BE ada di belakang lebih dari satu proxy.
app.set('trust proxy', 1)
app.use(cors({ origin: env.frontendUrl, credentials: true }))
app.use(morgan(env.isProduction ? 'combined' : 'dev'))
app.use(express.json({ limit: '1mb' })) // isi artikel blog bisa panjang
app.use(cookieParser())
app.use(passport.initialize())

app.use('/api/auth', authRoutes)
app.use('/api', categoriesRoutes, productsRoutes, blogRoutes, uploadsRoutes)
app.use('/api', addressesRoutes, shippingRoutes, cartRoutes, ordersRoutes, paymentRoutes, usersRoutes)

app.use(notFound)
app.use(errorHandler)
