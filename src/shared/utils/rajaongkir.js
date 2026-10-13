import { env } from '../config/env.js'
import { HttpError } from './httpError.js'

const BASE_URL = 'https://rajaongkir.komerce.id/api/v1'
const COURIERS = 'jne:sicepat:jnt:pos'

async function request(path, init = {}) {
  if (!env.rajaongkir.apiKey) throw new HttpError(503, 'Ongkir belum dikonfigurasi')
  const res = await fetch(BASE_URL + path, { ...init, headers: { key: env.rajaongkir.apiKey, ...init.headers } })
  if (res.status === 404) return [] // RajaOngkir membalas 404 kalau hasilnya kosong
  if (!res.ok) throw new HttpError(502, 'Gagal mengambil data dari RajaOngkir')
  return (await res.json()).data ?? []
}

// Cari wilayah tujuan (sampai kelurahan) untuk form alamat. Nama field sudah sesuai model Address.
export async function searchDestinations(search) {
  const data = await request(`/destination/domestic-destination?${new URLSearchParams({ search, limit: '20', offset: '0' })}`)
  return data.map((d) => ({
    destinationId: String(d.id),
    label: d.label,
    province: d.province_name,
    city: d.city_name,
    district: d.district_name,
    subdistrict: d.subdistrict_name,
    postalCode: d.zip_code,
  }))
}

// Semua layanan kurir dari gudang Shareen ke tujuan, termurah dulu. weight dalam gram.
export async function getShippingOptions(destinationId, weight) {
  const data = await request('/calculate/domestic-cost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      origin: env.rajaongkir.originId,
      destination: destinationId,
      weight: String(weight),
      courier: COURIERS,
      price: 'lowest',
    }),
  })
  return data.map((s) => ({
    courier: s.code,
    courierName: s.name,
    service: s.service,
    description: s.description,
    cost: s.cost,
    etd: s.etd,
  }))
}
