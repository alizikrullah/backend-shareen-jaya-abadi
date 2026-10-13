import { rateLimit, ipKeyGenerator } from 'express-rate-limit'

// IP asli pengunjung. Di production request masuk lewat Cloudflare Tunnel → Traefik, jadi req.ip berisi IP proxy
// (semua pengunjung terlihat satu IP dan berbagi satu jatah). Cloudflare mengirim IP asli di CF-Connecting-IP;
// server tidak bisa diakses langsung dari internet, jadi header ini tidak bisa dipalsukan.
const clientIp = (req) => req.headers['cf-connecting-ip'] ?? req.ip

// byUser: jatah dihitung per akun (untuk route yang sudah lewat authenticateToken)
export function limiter({ message, byUser = false, ...options }) {
  return rateLimit({
    ...options,
    message: { success: false, message },
    keyGenerator: (req) => (byUser && req.user ? `user:${req.user.id}` : ipKeyGenerator(clientIp(req))),
  })
}
