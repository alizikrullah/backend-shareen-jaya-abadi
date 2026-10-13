import * as categoriesService from './categories.service.js'

export async function list(req, res) {
  res.json({ success: true, data: await categoriesService.list() })
}

export async function create(req, res) {
  res.status(201).json({ success: true, data: await categoriesService.create(req.body) })
}

export async function update(req, res) {
  res.json({ success: true, data: await categoriesService.update(req.params.id, req.body) })
}

export async function remove(req, res) {
  await categoriesService.remove(req.params.id)
  res.json({ success: true, data: null })
}
