import { HttpError } from '../utils/httpError.js'

// Error Prisma yang umum → status + pesan yang bisa dibaca user
const prismaErrors = {
  P2002: [409, 'Data sudah ada'],
  P2003: [409, 'Data masih dipakai oleh data lain'],
  P2025: [404, 'Data tidak ditemukan'],
}

export function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' })
}

export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message })
  }
  if (prismaErrors[err.code]) {
    const [status, message] = prismaErrors[err.code]
    return res.status(status).json({ success: false, message })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Body JSON tidak valid' })
  }

  console.error(err)
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' })
}
