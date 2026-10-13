import { HttpError } from '../../shared/utils/httpError.js'
import { getShippingOptions } from '../../shared/utils/rajaongkir.js'
import { getCart } from '../cart/cart.service.js'
import { getOwned } from '../addresses/addresses.service.js'

// Pilihan kurir + ongkir untuk isi cart user ke alamat yang dipilih (berat dihitung dari cart di server)
export async function getOptions(userId, addressId) {
  const address = await getOwned(userId, addressId)
  const { items, totalWeight } = await getCart(userId)
  if (!items.length) throw new HttpError(400, 'Keranjang masih kosong')
  return getShippingOptions(address.destinationId, totalWeight)
}
