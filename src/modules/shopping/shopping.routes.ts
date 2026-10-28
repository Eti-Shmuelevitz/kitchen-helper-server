import { Router } from 'express';
import { managerOnly, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './shopping.controller';
import { addItemSchema, boughtSchema, finishSchema, reviewSchema, shoppingQuery } from './shopping.schemas';

export const shoppingRoutes = Router();
shoppingRoutes.use(requireAuth);

shoppingRoutes.get('/', validate('query', shoppingQuery), h(c.list));
shoppingRoutes.get('/requests', h(c.requests));
shoppingRoutes.post('/', validate('body', addItemSchema), h(c.add));
shoppingRoutes.patch('/bought', validate('body', boughtSchema), h(c.bought));
shoppingRoutes.post('/finish', validate('body', finishSchema), h(c.finish));
shoppingRoutes.patch('/:id/review', managerOnly, validate('params', idParam), validate('body', reviewSchema), h(c.review));
shoppingRoutes.delete('/:id', managerOnly, validate('params', idParam), h(c.remove));
