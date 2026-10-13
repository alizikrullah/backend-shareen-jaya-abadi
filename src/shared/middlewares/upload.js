import multer from 'multer'
import { HttpError } from '../utils/httpError.js'

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

// Terima maksimal 10 gambar di field "files", masing-masing ≤ 5 MB. Disimpan di memori lalu diteruskan ke Directus.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) =>
    allowedTypes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new HttpError(400, 'Format gambar harus JPG, PNG, atau WEBP')),
}).array('files', 10)
