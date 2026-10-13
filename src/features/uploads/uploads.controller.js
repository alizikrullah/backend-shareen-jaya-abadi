import { HttpError } from '../../shared/utils/httpError.js'
import { uploadToDirectus } from '../../shared/utils/directus.js'

// Upload dulu → dapat URL → URL dikirim bareng form produk/artikel
export async function upload(req, res) {
  if (!req.files?.length) throw new HttpError(400, 'Pilih minimal satu gambar')
  res.status(201).json({ success: true, data: await Promise.all(req.files.map((file) => uploadToDirectus(file))) })
}
