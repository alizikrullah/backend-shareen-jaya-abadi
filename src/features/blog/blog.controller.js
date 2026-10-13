import { z } from 'zod'
import { paginationQuery } from '../../shared/utils/pagination.js'
import * as blogService from './blog.service.js'

const publicListQuery = z.object({ kategori: z.string().trim().optional(), ...paginationQuery })
const adminListQuery = z.object(paginationQuery)

export async function listPublished(req, res) {
  const { items, meta } = await blogService.listPublished(publicListQuery.parse(req.query))
  res.json({ success: true, data: items, meta })
}

export async function getPublished(req, res) {
  res.json({ success: true, data: await blogService.getPublished(req.params.slug) })
}

export async function listAll(req, res) {
  const { items, meta } = await blogService.listAll(adminListQuery.parse(req.query))
  res.json({ success: true, data: items, meta })
}

export async function getById(req, res) {
  res.json({ success: true, data: await blogService.getById(req.params.id) })
}

export async function create(req, res) {
  res.status(201).json({ success: true, data: await blogService.create(req.body) })
}

export async function update(req, res) {
  res.json({ success: true, data: await blogService.update(req.params.id, req.body) })
}

export async function remove(req, res) {
  await blogService.remove(req.params.id)
  res.json({ success: true, data: null })
}

export async function listCategories(req, res) {
  res.json({ success: true, data: await blogService.listCategories() })
}

export async function createCategory(req, res) {
  res.status(201).json({ success: true, data: await blogService.createCategory(req.body) })
}

export async function updateCategory(req, res) {
  res.json({ success: true, data: await blogService.updateCategory(req.params.id, req.body) })
}

export async function removeCategory(req, res) {
  await blogService.removeCategory(req.params.id)
  res.json({ success: true, data: null })
}
