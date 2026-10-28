import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import * as service from './auth.service';
import { loginSchema, registerSchema, updateMeSchema } from './auth.schemas';

export async function register(req: Request, res: Response) {
  res.status(201).json(await service.register(valid(req, 'body', registerSchema)));
}

export async function login(req: Request, res: Response) {
  res.json(await service.login(valid(req, 'body', loginSchema)));
}

export async function me(req: Request, res: Response) {
  res.json(await service.me(currentUser(req)));
}

export async function updateMe(req: Request, res: Response) {
  res.json(await service.updateMe(currentUser(req), valid(req, 'body', updateMeSchema)));
}
