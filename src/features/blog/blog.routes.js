import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../shared/middlewares/validate.js'
import { adminOnly } from '../../shared/middlewares/auth.js'
import { directusImageUrl } from '../../shared/utils/directus.js'
import * as blogController from './blog.controller.js'

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter').max(50, 'Nama kategori maksimal 50 karakter'),
})

const postSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(200, 'Judul maksimal 200 karakter'),
  content: z.string().min(1, 'Isi artikel wajib diisi').max(100_000, 'Isi artikel terlalu panjang'),
  excerpt: z.string().trim().max(300, 'Ringkasan maksimal 300 karakter').nullish(),
  thumbnailUrl: directusImageUrl.nullish(),
  postCategoryId: z.string().min(1, 'Kategori wajib dipilih'),
  published: z.boolean().default(false), // false = draft
})

export const blogRoutes = Router()
  .get('/posts', blogController.listPublished)
  .get('/posts/:slug', blogController.getPublished)
  .get('/admin/posts', adminOnly, blogController.listAll)
  .get('/admin/posts/:id', adminOnly, blogController.getById)
  .post('/posts', adminOnly, validate(postSchema), blogController.create)
  .put('/posts/:id', adminOnly, validate(postSchema), blogController.update)
  .delete('/posts/:id', adminOnly, blogController.remove)
  .get('/post-categories', blogController.listCategories)
  .post('/post-categories', adminOnly, validate(categorySchema), blogController.createCategory)
  .put('/post-categories/:id', adminOnly, validate(categorySchema), blogController.updateCategory)
  .delete('/post-categories/:id', adminOnly, blogController.removeCategory)
