import { prisma } from '../src/shared/prisma.js'

// Akun admin tidak dibuat di sini: daftar seperti biasa, lalu ubah role jadi ADMIN langsung di database.
const kategoriAwal = [
  { name: 'Jacquard', slug: 'jacquard' },
  { name: 'Viscose Jacquard', slug: 'viscose-jacquard' },
  { name: 'Printing', slug: 'printing' },
  { name: 'Uniform', slug: 'uniform' },
  { name: 'Semiwool', slug: 'semiwool' },
]

for (const kategori of kategoriAwal) {
  await prisma.category.upsert({ where: { slug: kategori.slug }, update: {}, create: kategori })
}

console.log(`Seed selesai: ${kategoriAwal.length} kategori`)
await prisma.$disconnect()
