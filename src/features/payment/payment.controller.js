import * as paymentService from './payment.service.js'

export async function token(req, res) {
  res.json({ success: true, data: await paymentService.createToken(req.user.id, req.body.orderId) })
}

export async function status(req, res) {
  res.json({ success: true, data: await paymentService.syncStatus(req.user.id, req.body.orderId) })
}

export async function notification(req, res) {
  await paymentService.handleNotification(req.body ?? {})
  res.json({ success: true, data: null })
}
