import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../shared/prisma.js'
import { env } from '../../shared/config/env.js'
import { HttpError } from '../../shared/utils/httpError.js'

// Buang field rahasia sebelum user dikirim ke client
const toPublicUser = ({ password, googleId, updatedAt, ...user }) => user

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '7d' })

export async function register({ name, email, password }) {
  try {
    const user = await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 10) },
    })
    return toPublicUser(user)
  } catch (err) {
    if (err.code === 'P2002') throw new HttpError(409, 'Email sudah terdaftar')
    throw err
  }
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (user && !user.password) {
    throw new HttpError(400, 'Akun ini terdaftar lewat Google, silakan login dengan Google')
  }
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, 'Email atau password salah')
  }
  return toPublicUser(user)
}

export async function loginWithGoogle(profile) {
  const email = profile.emails?.[0]?.value?.toLowerCase()
  if (!email || profile._json?.email_verified !== true) {
    throw new HttpError(400, 'Email Google belum terverifikasi')
  }

  const linked = await prisma.user.findUnique({ where: { googleId: profile.id } })
  if (linked) return toPublicUser(linked)

  // Email sudah terdaftar → link ke Google DAN hapus password lama. Google sudah membuktikan
  // pemilik email, jadi orang lain yang dulu daftar pakai email ini tidak bisa login lagi.
  const user = await prisma.user.upsert({
    where: { email },
    update: { googleId: profile.id, password: null },
    create: { email, name: profile.displayName || email, googleId: profile.id },
  })
  return toPublicUser(user)
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new HttpError(404, 'User tidak ditemukan')
  return toPublicUser(user)
}

export async function updateMe(userId, { name }) {
  return toPublicUser(await prisma.user.update({ where: { id: userId }, data: { name } }))
}
