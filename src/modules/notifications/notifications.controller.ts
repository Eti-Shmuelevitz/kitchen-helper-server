import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import * as service from './notifications.service';
import { listNotificationsQuery, markReadSchema } from './notifications.schemas';

export async function list(req: Request, res: Response) {
  res.json(await service.list(currentUser(req), valid(req, 'query', listNotificationsQuery)));
}
export async function markRead(req: Request, res: Response) {
  await service.markRead(currentUser(req), valid(req, 'body', markReadSchema));
  res.status(204).end();
}
