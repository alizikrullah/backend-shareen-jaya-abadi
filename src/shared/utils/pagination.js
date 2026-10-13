import { z } from 'zod'

// Dipakai di skema query list: z.object({ ...paginationQuery, ... })
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
}

export const toSkipTake = ({ page, limit }) => ({ skip: (page - 1) * limit, take: limit })
