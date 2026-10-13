import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { adminOnly } from '../../shared/middlewares/auth.js'
import * as categoriesController from './categories.controller.js'

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter').max(50, 'Nama kategori maksimal 50 karakter'),
})

export const categoriesRoutes = Router()
  .get('/categories', categoriesController.list)
  .post('/categories', adminOnly, validate(categorySchema), categoriesController.create)
  .put('/categories/:id', adminOnly, validate(categorySchema), categoriesController.update)
  .delete('/categories/:id', adminOnly, categoriesController.remove)
