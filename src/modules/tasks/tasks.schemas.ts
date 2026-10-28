import { z } from 'zod';
import { boolQuery, page, pageSize } from '../../shared/schemas';
import { isoDate } from '../../utils/dates';

const title = z.string().trim().min(2, 'כותרת של 2 תווים לפחות').max(80, 'כותרת של עד 80 תווים');
const userId = z.string().uuid('צריך לבחור בן בית');

export const listTasksQuery = z.object({
  status: z.enum(['OPEN', 'DONE']).optional(),
  assignedTo: z.string().uuid().optional(),
  isErevShabbat: boolQuery.optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(['dueDate', 'createdAt', 'title']).default('dueDate'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page,
  pageSize,
});

export const createTaskSchema = z.object({
  title,
  assignedToId: userId,
  dueDate: isoDate.nullable().optional(),
  isErevShabbat: z.boolean().default(false),
});

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    assignedToId: userId.optional(),
    dueDate: isoDate.nullable().optional(),
    status: z.enum(['OPEN', 'DONE']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'לא נשלח שום שדה לעדכון');

export const createTemplateSchema = z.object({
  title,
  daysBeforeShabbat: z.number().int().min(0).max(2).default(0),
  defaultAssigneeId: userId.nullable().optional(),
});

export const erevShabbatSchema = z.object({
  assignments: z
    .array(z.object({ templateId: z.string().uuid(), assignedToId: userId }))
    .max(50)
    .default([]),
});
