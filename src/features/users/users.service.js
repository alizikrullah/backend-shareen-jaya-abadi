import { prisma } from '../../shared/prisma.js'
import { toSkipTake } from '../../shared/utils/pagination.js'

// Daftar user untuk admin. Password & googleId tidak pernah dikirim — cukup tanda "terhubung Google".
export async function list({ search, ...page }) {
  const where = search
    ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
    : {}
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, googleId: true, createdAt: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(page),
    }),
    prisma.user.count({ where }),
  ])
  return {
    items: users.map(({ googleId, _count, ...user }) => ({ ...user, googleLinked: Boolean(googleId), orderCount: _count.orders })),
    meta: { ...page, total },
  }
}
