import { PrismaClient } from '@prisma/client';

// חיבור יחיד למסד הנתונים לכל השרת
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
