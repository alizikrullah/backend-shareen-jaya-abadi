import { z } from 'zod'
import { paginationQuery } from '../../shared/utils/pagination.js'
import * as productsService from './products.service.js'

const listQuery = z.object({
  kategori: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['terbaru', 'terlaris', 'harga_asc', 'harga_desc']).default('terbaru'),
  ...paginationQuery,
})

export async function list(req, res) {
  const { items, meta } = await productsService.list(listQuery.parse(req.query))
  res.json({ success: true, data: items, meta })
}

export async function getBySlug(req, res) {
  res.json({ success: true, data: await productsService.getOne({ slug: req.params.slug }) })
}

export async function getById(req, res) {
  res.json({ success: true, data: await productsService.getOne({ id: req.params.id }) })
}

export async function create(req, res) {
  res.status(201).json({ success: true, data: await productsService.create(req.body) })
}

export async function update(req, res) {
  res.json({ success: true, data: await productsService.update(req.params.id, req.body) })
}

export async function remove(req, res) {
  await productsService.remove(req.params.id)
  res.json({ success: true, data: null })
}

export async function addColor(req, res) {
  res.status(201).json({ success: true, data: await productsService.addColor(req.params.productId, req.body) })
}

export async function updateColor(req, res) {
  const { productId, colorId } = req.params
  res.json({ success: true, data: await productsService.updateColor(productId, colorId, req.body) })
}

export async function removeColor(req, res) {
  await productsService.removeColor(req.params.productId, req.params.colorId)
  res.json({ success: true, data: null })
}
