import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './today.controller';

export const todayRoutes = Router();
todayRoutes.get('/', requireAuth, h(c.get));
