import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import * as service from './pantry.service';
import { ingredientIdParam, updatePantrySchema } from './pantry.schemas';

export async function get(req: Request, res: Response) {
  res.json(await service.getPantry(currentUser(req)));
}
export async function update(req: Request, res: Response) {
  res.json(await service.setInStock(currentUser(req), valid(req, 'params', ingredientIdParam).ingredientId, valid(req, 'body', updatePantrySchema)));
}
