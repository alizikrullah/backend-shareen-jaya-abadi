import { Router } from 'express'
import { adminOnly } from '../../shared/middlewares/auth.js'
import { imageUpload } from '../../shared/middlewares/upload.js'
import * as uploadsController from './uploads.controller.js'

export const uploadsRoutes = Router().post('/admin/uploads', adminOnly, imageUpload, uploadsController.upload)
