import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './notifications.controller';
import { listNotificationsQuery, markReadSchema } from './notifications.schemas';

export const notificationRoutes = Router();
notificationRoutes.use(requireAuth);

notificationRoutes.get('/', validate('query', listNotificationsQuery), h(c.list));
notificationRoutes.patch('/read', validate('body', markReadSchema), h(c.markRead));
