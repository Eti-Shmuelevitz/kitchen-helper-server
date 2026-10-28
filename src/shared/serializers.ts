import type { User } from '@prisma/client';

/** משתמש כפי שהוא חוזר מה־API: בלי סיסמה ובלי Hash */
export function publicUser(u: Pick<User, 'id' | 'name' | 'email' | 'role' | 'color' | 'householdId' | 'createdAt'>) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, householdId: u.householdId, createdAt: u.createdAt };
}

export const userBrief = { select: { id: true, name: true, color: true } } as const;
