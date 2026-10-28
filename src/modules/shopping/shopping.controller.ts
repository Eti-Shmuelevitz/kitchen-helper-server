import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import * as service from './shopping.service';
import { addItemSchema, boughtSchema, reviewSchema, shoppingQuery } from './shopping.schemas';

export async function list(req: Request, res: Response) {
  res.json(await service.getList(currentUser(req), valid(req, 'query', shoppingQuery).week));
}
export async function requests(req: Request, res: Response) {
  res.json(await service.listRequests(currentUser(req)));
}
export async function add(req: Request, res: Response) {
  res.status(201).json(await service.addItem(currentUser(req), valid(req, 'body', addItemSchema)));
}
export async function review(req: Request, res: Response) {
  res.json(await service.review(currentUser(req), valid(req, 'params', idParam).id, valid(req, 'body', reviewSchema)));
}
export async function bought(req: Request, res: Response) {
  res.json(await service.markBought(currentUser(req), valid(req, 'body', boughtSchema)));
}
export async function finish(req: Request, res: Response) {
  res.json(await service.finish(currentUser(req)));
}
export async function remove(req: Request, res: Response) {
  await service.removeItem(currentUser(req), valid(req, 'params', idParam).id);
  res.status(204).end();
}
