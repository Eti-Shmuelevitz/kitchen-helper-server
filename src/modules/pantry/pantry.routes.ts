import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './pantry.controller';
import { ingredientIdParam, updatePantrySchema } from './pantry.schemas';

export const pantryRoutes = Router();
pantryRoutes.use(requireAuth);

pantryRoutes.get('/', h(c.get));
pantryRoutes.patch('/:ingredientId', validate('params', ingredientIdParam), validate('body', updatePantrySchema), h(c.update));
