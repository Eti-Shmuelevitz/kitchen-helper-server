import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import * as service from './recipes.service';
import { createRecipeSchema, listRecipesQuery, recipeDetailQuery, statusSchema, updateRecipeSchema, wheelQuery } from './recipes.schemas';

const id = (req: Request) => valid(req, 'params', idParam).id;

export async function list(req: Request, res: Response) {
  res.json(await service.list(currentUser(req), valid(req, 'query', listRecipesQuery)));
}
export async function detail(req: Request, res: Response) {
  res.json(await service.detail(currentUser(req), id(req), valid(req, 'query', recipeDetailQuery)));
}
export async function create(req: Request, res: Response) {
  res.status(201).json(await service.create(currentUser(req), valid(req, 'body', createRecipeSchema)));
}
export async function update(req: Request, res: Response) {
  res.json(await service.update(currentUser(req), id(req), valid(req, 'body', updateRecipeSchema)));
}
export async function setStatus(req: Request, res: Response) {
  res.json(await service.setStatus(currentUser(req), id(req), valid(req, 'body', statusSchema)));
}
export async function vote(req: Request, res: Response) {
  res.status(201).json(await service.vote(currentUser(req), id(req)));
}
export async function unvote(req: Request, res: Response) {
  res.json(await service.unvote(currentUser(req), id(req)));
}
export async function favorite(req: Request, res: Response) {
  await service.favorite(currentUser(req), id(req));
  res.status(204).end();
}
export async function unfavorite(req: Request, res: Response) {
  await service.unfavorite(currentUser(req), id(req));
  res.status(204).end();
}
export async function wheel(req: Request, res: Response) {
  res.json(await service.wheel(currentUser(req), valid(req, 'query', wheelQuery).mode));
}
export async function uploadImage(req: Request, res: Response) {
  res.json(await service.uploadImage(currentUser(req), id(req), req.file));
}
export async function removeImage(req: Request, res: Response) {
  await service.removeImage(currentUser(req), id(req));
  res.status(204).end();
}
export async function getImage(req: Request, res: Response) {
  const img = await service.getImage(id(req));
  res.setHeader('Content-Type', img.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(Buffer.from(img.data));
}
