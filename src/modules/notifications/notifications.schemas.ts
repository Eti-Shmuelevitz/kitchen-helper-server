import { z } from 'zod';
import { boolQuery } from '../../shared/schemas';

export const listNotificationsQuery = z.object({ unreadOnly: boolQuery.optional() });
export const markReadSchema = z.object({ ids: z.array(z.string().uuid()).max(100).optional() });
