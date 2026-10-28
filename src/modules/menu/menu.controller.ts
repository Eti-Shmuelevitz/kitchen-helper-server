import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import * as service from './menu.service';
import { createEntrySchema, menuQuery, updateEntrySchema } from './menu.schemas';

export async function week(req: Request, res: Response) {
  res.json(await service.getWeek(currentUser(req), valid(req, 'query', menuQuery)));
}
export async function add(req: Request, res: Response) {
  res.status(201).json(await service.addEntry(currentUser(req), valid(req, 'body', createEntrySchema)));
}
export async function update(req: Request, res: Response) {
  res.json(await service.updateEntry(currentUser(req), valid(req, 'params', idParam).id, valid(req, 'body', updateEntrySchema)));
}
export async function remove(req: Request, res: Response) {
  await service.removeEntry(currentUser(req), valid(req, 'params', idParam).id);
  res.status(204).end();
}
