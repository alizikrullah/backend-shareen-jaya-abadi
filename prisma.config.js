import { defineConfig } from 'prisma/config'

// Prisma 7 tidak membaca .env otomatis. Di production env datang dari Coolify, jadi .env boleh tidak ada.
try {
  process.loadEnvFile()
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
