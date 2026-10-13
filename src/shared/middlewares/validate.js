// Validasi req.body dengan skema Zod. Field yang tidak ada di skema dibuang (cegah mass assignment).
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {})
  if (!result.success) {
    const errors = {}
    for (const issue of result.error.issues) {
      errors[issue.path.join('.')] ??= issue.message
    }
    return res.status(400).json({ success: false, message: 'Data tidak valid', errors })
  }
  req.body = result.data
  next()
}
