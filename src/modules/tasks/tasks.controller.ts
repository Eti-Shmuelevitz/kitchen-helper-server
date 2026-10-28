import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import * as service from './tasks.service';
import { createTaskSchema, createTemplateSchema, erevShabbatSchema, listTasksQuery, updateTaskSchema } from './tasks.schemas';

const id = (req: Request) => valid(req, 'params', idParam).id;

export async function list(req: Request, res: Response) {
  res.json(await service.list(currentUser(req), valid(req, 'query', listTasksQuery)));
}
export async function create(req: Request, res: Response) {
  res.status(201).json(await service.create(currentUser(req), valid(req, 'body', createTaskSchema)));
}
export async function update(req: Request, res: Response) {
  res.json(await service.update(currentUser(req), id(req), valid(req, 'body', updateTaskSchema)));
}
export async function remove(req: Request, res: Response) {
  await service.remove(currentUser(req), id(req));
  res.status(204).end();
}
export async function toggle(req: Request, res: Response) {
  res.json(await service.toggle(currentUser(req), id(req)));
}
export async function stars(req: Request, res: Response) {
  res.json(await service.stars(currentUser(req)));
}
export async function erevShabbat(req: Request, res: Response) {
  res.status(201).json(await service.createErevShabbatTasks(currentUser(req), valid(req, 'body', erevShabbatSchema)));
}
export async function listTemplates(req: Request, res: Response) {
  res.json(await service.listTemplates(currentUser(req)));
}
export async function createTemplate(req: Request, res: Response) {
  res.status(201).json(await service.createTemplate(currentUser(req), valid(req, 'body', createTemplateSchema)));
}
export async function removeTemplate(req: Request, res: Response) {
  await service.removeTemplate(currentUser(req), id(req));
  res.status(204).end();
}
