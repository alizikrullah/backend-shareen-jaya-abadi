import { z } from 'zod'
import { paginationQuery } from '../../shared/utils/pagination.js'
import * as usersService from './users.service.js'

const listQuery = z.object({ search: z.string().trim().max(100).optional(), ...paginationQuery })

export async function list(req, res) {
  const { items, meta } = await usersService.list(listQuery.parse(req.query))
  res.json({ success: true, data: items, meta })
}
