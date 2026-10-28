import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { valid } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import * as service from './household.service';
import { updateMemberSchema } from './household.schemas';

export async function get(req: Request, res: Response) {
  res.json(await service.getHousehold(currentUser(req)));
}
export async function members(req: Request, res: Response) {
  res.json(await service.listMembers(currentUser(req)));
}
export async function updateMember(req: Request, res: Response) {
  res.json(await service.updateMember(currentUser(req), valid(req, 'params', idParam).id, valid(req, 'body', updateMemberSchema)));
}
export async function removeMember(req: Request, res: Response) {
  await service.removeMember(currentUser(req), valid(req, 'params', idParam).id);
  res.status(204).end();
}
export async function inviteCode(req: Request, res: Response) {
  res.json(await service.regenerateInviteCode(currentUser(req)));
}
