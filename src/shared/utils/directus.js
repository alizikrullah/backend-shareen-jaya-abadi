import { z } from 'zod'
import { env } from '../config/env.js'
import { HttpError } from './httpError.js'

const { url, token } = env.directus
const assetPrefix = `${url}/assets/`
const auth = { Authorization: `Bearer ${token}` }

// URL gambar wajib hasil upload ke Directus kita, bukan link luar sembarangan
export const directusImageUrl = z.url().refine((value) => value.startsWith(assetPrefix), 'Gambar harus hasil upload')

export async function uploadToDirectus(file) {
  if (!url || !token) throw new HttpError(503, 'Penyimpanan gambar belum dikonfigurasi')

  const form = new FormData()
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname)
  const res = await fetch(`${url}/files`, { method: 'POST', headers: auth, body: form })
  if (!res.ok) throw new HttpError(502, 'Gagal upload gambar ke Directus')

  const { data } = await res.json()
  return { id: data.id, url: assetPrefix + data.id }
}

// Hapus file di Directus. Kalau gagal, request tetap jalan — paling jadi file yatim, dicatat di log.
export async function removeFromDirectus(urls) {
  const ids = urls.filter((value) => value?.startsWith(assetPrefix)).map((value) => value.slice(assetPrefix.length))
  await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`${url}/files/${id}`, { method: 'DELETE', headers: auth }).catch(() => null)
      if (!res?.ok) console.error(`Gagal hapus file Directus ${id}`)
    }),
  )
}
