# Image backend Shareen untuk Coolify (build pack: Dockerfile)
FROM node:24-alpine

# CLI Prisma (migrate) butuh OpenSSL
RUN apk add --no-cache openssl

WORKDIR /app

# Dependency diinstall dulu supaya cache layer terpakai. postinstall menjalankan `prisma generate`,
# jadi schema & config Prisma harus sudah ada. Dev dependency ikut terpasang karena CLI Prisma
# dipakai untuk menjalankan migration saat container start.
COPY package.json package-lock.json prisma.config.js ./
COPY prisma ./prisma
RUN npm ci && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/api/health" > /dev/null || exit 1

# Terapkan migration yang belum jalan, lalu start server.
# exec → node jadi proses utama dan menerima sinyal stop dari Docker.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node src/server.js"]
