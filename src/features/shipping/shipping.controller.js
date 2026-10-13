import { z } from 'zod'
import { searchDestinations } from '../../shared/utils/rajaongkir.js'
import * as shippingService from './shipping.service.js'

const destinationsQuery = z.object({ search: z.string().trim().min(3, 'Ketik minimal 3 huruf').max(100) })

export async function destinations(req, res) {
  const { search } = destinationsQuery.parse(req.query)
  res.json({ success: true, data: await searchDestinations(search) })
}

export async function cost(req, res) {
  res.json({ success: true, data: await shippingService.getOptions(req.user.id, req.body.addressId) })
}
