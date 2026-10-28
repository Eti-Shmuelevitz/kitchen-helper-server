import { Router } from 'express';
import { managerOnly, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './ingredients.controller';
import { createIngredientSchema, listIngredientsQuery, updateIngredientSchema } from './ingredients.schemas';

export const ingredientRoutes = Router();
ingredientRoutes.use(requireAuth);

ingredientRoutes.get('/', validate('query', listIngredientsQuery), h(c.list));
ingredientRoutes.post('/', managerOnly, validate('body', createIngredientSchema), h(c.create));
ingredientRoutes.patch('/:id', managerOnly, validate('params', idParam), validate('body', updateIngredientSchema), h(c.update));
