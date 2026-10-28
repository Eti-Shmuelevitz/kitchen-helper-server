import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './auth.controller';
import { loginSchema, registerSchema, updateMeSchema } from './auth.schemas';

export const authRoutes = Router();

authRoutes.post('/register', rateLimit(20), validate('body', registerSchema), h(c.register));
authRoutes.post('/login', rateLimit(30), validate('body', loginSchema), h(c.login));
authRoutes.get('/me', requireAuth, h(c.me));
authRoutes.patch('/me', requireAuth, validate('body', updateMeSchema), h(c.updateMe));
