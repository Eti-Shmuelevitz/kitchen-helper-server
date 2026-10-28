import { Router } from 'express';
import { managerOnly, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './menu.controller';
import { createEntrySchema, menuQuery, updateEntrySchema } from './menu.schemas';

export const menuRoutes = Router();
menuRoutes.use(requireAuth);

menuRoutes.get('/', validate('query', menuQuery), h(c.week));
menuRoutes.post('/', managerOnly, validate('body', createEntrySchema), h(c.add));
menuRoutes.patch('/:id', managerOnly, validate('params', idParam), validate('body', updateEntrySchema), h(c.update));
menuRoutes.delete('/:id', managerOnly, validate('params', idParam), h(c.remove));
