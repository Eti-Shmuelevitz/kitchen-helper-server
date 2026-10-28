import { Router } from 'express';
import { managerOnly, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import { asyncHandler as h } from '../../utils/asyncHandler';
import * as c from './tasks.controller';
import { createTaskSchema, createTemplateSchema, erevShabbatSchema, listTasksQuery, updateTaskSchema } from './tasks.schemas';

export const taskRoutes = Router();
taskRoutes.use(requireAuth);

taskRoutes.get('/', validate('query', listTasksQuery), h(c.list));
taskRoutes.get('/stars', h(c.stars));
taskRoutes.post('/', managerOnly, validate('body', createTaskSchema), h(c.create));
taskRoutes.post('/erev-shabbat', managerOnly, validate('body', erevShabbatSchema), h(c.erevShabbat));
taskRoutes.patch('/:id/toggle', validate('params', idParam), h(c.toggle));
taskRoutes.patch('/:id', managerOnly, validate('params', idParam), validate('body', updateTaskSchema), h(c.update));
taskRoutes.delete('/:id', managerOnly, validate('params', idParam), h(c.remove));

export const templateRoutes = Router();
templateRoutes.use(requireAuth, managerOnly);

templateRoutes.get('/', h(c.listTemplates));
templateRoutes.post('/', validate('body', createTemplateSchema), h(c.createTemplate));
templateRoutes.delete('/:id', validate('params', idParam), h(c.removeTemplate));
