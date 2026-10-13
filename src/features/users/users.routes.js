import { Router } from 'express'
import { adminOnly } from '../../shared/middlewares/auth.js'
import * as usersController from './users.controller.js'

export const usersRoutes = Router().get('/admin/users', adminOnly, usersController.list)
