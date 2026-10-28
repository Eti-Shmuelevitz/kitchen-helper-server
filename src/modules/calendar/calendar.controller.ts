import type { Request, Response } from 'express';
import { valid } from '../../middleware/validate';
import * as service from './calendar.service';
import { weekQuery } from './calendar.schemas';

export function week(req: Request, res: Response) {
  res.json(service.week(valid(req, 'query', weekQuery).date));
}
