import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function authenticateToken(req, res, next) {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ success: false, message: 'Silakan login dulu' })

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
    req.user = { id: payload.sub, role: payload.role }
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Sesi habis, silakan login ulang' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Khusus admin' })
  next()
}

// Pasang di route admin: router.post('/products', adminOnly, ...)
export const adminOnly = [authenticateToken, requireAdmin]
