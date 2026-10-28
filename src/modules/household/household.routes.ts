import { Router } from 'express';
import { managerOnly, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './household.controller';
import { updateMemberSchema } from './household.schemas';

export const householdRoutes = Router();
householdRoutes.use(requireAuth);

householdRoutes.get('/', h(c.get));
householdRoutes.get('/members', managerOnly, h(c.members));
householdRoutes.patch('/members/:id', managerOnly, validate('params', idParam), validate('body', updateMemberSchema), h(c.updateMember));
householdRoutes.delete('/members/:id', managerOnly, validate('params', idParam), h(c.removeMember));
householdRoutes.post('/invite-code', managerOnly, h(c.inviteCode));
