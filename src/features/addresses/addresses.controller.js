import * as addressesService from './addresses.service.js'

export async function list(req, res) {
  res.json({ success: true, data: await addressesService.list(req.user.id) })
}

export async function create(req, res) {
  res.status(201).json({ success: true, data: await addressesService.create(req.user.id, req.body) })
}

export async function update(req, res) {
  res.json({ success: true, data: await addressesService.update(req.user.id, req.params.id, req.body) })
}

export async function remove(req, res) {
  await addressesService.remove(req.user.id, req.params.id)
  res.json({ success: true, data: null })
}

export async function setDefault(req, res) {
  res.json({ success: true, data: await addressesService.setDefault(req.user.id, req.params.id) })
}
