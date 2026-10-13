import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { env } from './shared/config/env.js'
import { passport } from './shared/config/passport.js'
import { authRoutes } from './features/auth/auth.routes.js'
import { notFound, errorHandler } from './shared/middlewares/errorHandler.js'

export const app = express()

// ponytail: percaya 1 proxy (Traefik di Coolify) supaya IP asli & cookie secure terbaca benar.
// Naikkan angkanya kalau nanti BE ada di belakang lebih dari satu proxy.
app.set('trust proxy', 1)
app.use(cors({ origin: env.frontendUrl, credentials: true }))
app.use(morgan(env.isProduction ? 'combined' : 'dev'))
app.use(express.json())
app.use(cookieParser())
app.use(passport.initialize())

app.use('/api/auth', authRoutes)

app.use(notFound)
app.use(errorHandler)
