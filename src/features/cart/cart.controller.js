import * as cartService from './cart.service.js'

// Semua aksi cart membalas isi cart terbaru (items + subtotal + totalWeight)

export async function get(req, res) {
  res.json({ success: true, data: await cartService.getCart(req.user.id) })
}

export async function add(req, res) {
  res.status(201).json({ success: true, data: await cartService.add(req.user.id, req.body) })
}

export async function update(req, res) {
  res.json({ success: true, data: await cartService.update(req.user.id, req.params.itemId, req.body) })
}

export async function remove(req, res) {
  res.json({ success: true, data: await cartService.remove(req.user.id, req.params.itemId) })
}
