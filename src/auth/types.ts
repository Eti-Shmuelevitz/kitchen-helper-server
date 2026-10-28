import type { Role } from '@prisma/client';

/** המשתמש המחובר, כפי שהוא נטען מה־token בכל בקשה */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  color: string;
  householdId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
