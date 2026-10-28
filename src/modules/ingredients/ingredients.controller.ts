import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import * as service from './ingredients.service';
import { createIngredientSchema, listIngredientsQuery, updateIngredientSchema } from './ingredients.schemas';

export async function list(req: Request, res: Response) {
  res.json(await service.list(currentUser(req), valid(req, 'query', listIngredientsQuery)));
}
export async function create(req: Request, res: Response) {
  res.status(201).json(await service.create(currentUser(req), valid(req, 'body', createIngredientSchema)));
}
export async function update(req: Request, res: Response) {
  res.json(await service.update(currentUser(req), valid(req, 'params', idParam).id, valid(req, 'body', updateIngredientSchema)));
}
