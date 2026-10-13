import { z } from 'zod'
import { paginationQuery } from '../../shared/utils/pagination.js'
import * as ordersService from './orders.service.js'

const myListQuery = z.object(paginationQuery)
const adminListQuery = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']).optional(),
  ...paginationQuery,
})

export async function checkout(req, res) {
  res.status(201).json({ success: true, data: await ordersService.checkout(req.user.id, req.body) })
}

export async function listMine(req, res) {
  const { items, meta } = await ordersService.listMine(req.user.id, myListQuery.parse(req.query))
  res.json({ success: true, data: items, meta })
}

export async function getMine(req, res) {
  res.json({ success: true, data: await ordersService.getMine(req.user.id, req.params.id) })
}

export async function listAll(req, res) {
  const { items, meta } = await ordersService.listAll(adminListQuery.parse(req.query))
  res.json({ success: true, data: items, meta })
}

export async function getAny(req, res) {
  res.json({ success: true, data: await ordersService.getAny(req.params.id) })
}

export async function updateStatus(req, res) {
  res.json({ success: true, data: await ordersService.updateStatus(req.params.id, req.body) })
}

export async function stats(req, res) {
  res.json({ success: true, data: await ordersService.stats() })
}
