import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import * as service from './today.service';

export async function get(req: Request, res: Response) {
  res.json(await service.getTodaySummary(currentUser(req)));
}
