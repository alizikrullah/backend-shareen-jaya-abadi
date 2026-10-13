const required = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL']
const missing = required.filter((name) => !process.env[name])
if (missing.length) throw new Error(`Env belum diisi: ${missing.join(', ')}`)

const port = Number(process.env.PORT) || 3000

export const env = {
  port,
  isProduction: process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${port}/api/auth/google/callback`,
  },
  directus: {
    url: process.env.DIRECTUS_URL?.replace(/\/$/, ''),
    token: process.env.DIRECTUS_TOKEN,
  },
  rajaongkir: {
    apiKey: process.env.RAJAONGKIR_API_KEY,
    originId: process.env.RAJAONGKIR_ORIGIN_ID,
  },
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  },
}
