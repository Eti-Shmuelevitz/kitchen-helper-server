import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as c from './calendar.controller';
import { weekQuery } from './calendar.schemas';

export const calendarRoutes = Router();
calendarRoutes.get('/week', requireAuth, validate('query', weekQuery), c.week);
