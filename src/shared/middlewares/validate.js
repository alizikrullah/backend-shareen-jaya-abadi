// Validasi + bersihkan req.body dengan skema Zod. Field di luar skema dibuang (cegah mass assignment).
// Kalau tidak valid, ZodError diteruskan ke errorHandler → 400 dengan daftar error per field.
export const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body ?? {})
  next()
}
