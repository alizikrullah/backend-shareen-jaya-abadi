import crypto from 'node:crypto'
import { env } from '../../shared/config/env.js'
import { passport, isGoogleEnabled } from '../../shared/config/passport.js'
import * as authService from './auth.service.js'

const cookieOptions = { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: '/' }
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // samakan dengan expiresIn JWT (7 hari)

const setSessionCookie = (res, user) =>
  res.cookie('token', authService.signToken(user), { ...cookieOptions, maxAge: SESSION_MAX_AGE })

export async function register(req, res) {
  const user = await authService.register(req.body)
  setSessionCookie(res, user)
  res.status(201).json({ success: true, data: user })
}

export async function login(req, res) {
  const user = await authService.login(req.body)
  setSessionCookie(res, user)
  res.json({ success: true, data: user })
}

export function logout(req, res) {
  res.clearCookie('token', cookieOptions)
  res.json({ success: true, data: null })
}

export async function getMe(req, res) {
  res.json({ success: true, data: await authService.getMe(req.user.id) })
}

export async function updateMe(req, res) {
  res.json({ success: true, data: await authService.updateMe(req.user.id, req.body) })
}

export function googleStart(req, res, next) {
  if (!isGoogleEnabled) {
    return res.status(503).json({ success: false, message: 'Login Google belum dikonfigurasi' })
  }
  // state acak disimpan di cookie lalu dicocokkan saat callback, supaya callback palsu ditolak (login CSRF)
  const state = crypto.randomBytes(16).toString('hex')
  res.cookie('oauth_state', state, { ...cookieOptions, maxAge: 10 * 60 * 1000 })
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next)
}

export function googleCallback(req, res, next) {
  const fail = () => res.redirect(`${env.frontendUrl}/login?error=google`)
  const { state } = req.query
  res.clearCookie('oauth_state', cookieOptions)
  if (!isGoogleEnabled || !state || state !== req.cookies.oauth_state) return fail()

  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) return fail()
    setSessionCookie(res, user)
    res.redirect(env.frontendUrl)
  })(req, res, next)
}
