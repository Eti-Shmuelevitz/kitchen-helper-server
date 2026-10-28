import { z } from 'zod';
import { isoDate } from '../../utils/dates';

export const weekQuery = z.object({ date: isoDate.optional() });
