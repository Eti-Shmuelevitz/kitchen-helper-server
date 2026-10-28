import type { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { signToken } from '../../auth/jwt';
import { hashPassword, verifyPassword } from '../../auth/password';
import type { AuthUser } from '../../auth/types';
import { assertNotLocked, clearLoginFailures, recordLoginFailure } from '../../middleware/rateLimit';
import { createDefaultIngredients } from '../../services/defaults';
import { generateInviteCode } from '../../services/inviteCode';
import { publicUser } from '../../shared/serializers';
import { badRequest, conflict, HttpError, unauthorized } from '../../utils/httpError';
import type { loginSchema, registerSchema, updateMeSchema } from './auth.schemas';

const COLORS = ['#2c5c60', '#a97c22', '#7a5ba8', '#2f6a9e', '#a33a3a', '#2f7a4a', '#c2410c'];

async function assertEmailFree(email: string) {
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw conflict('כבר קיים משתמש עם המייל הזה');
}

/**
 * הבית המשותף: כל מי שנרשמת מצטרפת אליו.
 * זה הבית הראשון שנוצר במסד. אם אין אף בית (מסד ריק), הוא נוצר עכשיו, עם מצרכים בסיסיים.
 */
async function getSharedHousehold() {
  const existing = await prisma.household.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  const inviteCode = await generateInviteCode();
  return prisma.$transaction(async (tx) => {
    const household = await tx.household.create({ data: { name: 'הבית שלנו', inviteCode } });
    await createDefaultIngredients(tx, household.id);
    return household;
  });
}

/** הרשמה: בן משפחה, או מנהלת הבית (רק עם קוד המנהלת הנכון) */
export async function register(input: z.infer<typeof registerSchema>) {
  if (input.role === 'MANAGER' && input.managerCode !== env.MANAGER_CODE) {
    throw badRequest('קוד המנהלת שגוי', [{ field: 'managerCode', message: 'קוד שגוי' }]);
  }
  await assertEmailFree(input.email);
  const household = await getSharedHousehold();
  const count = await prisma.user.count({ where: { householdId: household.id } });
  const user = await prisma.user.create({
    data: {
      householdId: household.id,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      color: COLORS[count % COLORS.length],
    },
  });
  return { token: signToken(user.id), user: publicUser(user), household: { id: household.id, name: household.name } };
}

export async function login(input: z.infer<typeof loginSchema>) {
  assertNotLocked(input.email);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    recordLoginFailure(input.email);
    throw unauthorized('מייל או סיסמה שגויים');
  }
  clearLoginFailures(input.email);
  return { token: signToken(user.id), user: publicUser(user) };
}

export async function me(auth: AuthUser) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.id }, include: { household: true } });
  const unreadNotifications = await prisma.notification.count({ where: { userId: auth.id, isRead: false } });
  return { user: publicUser(user), household: { id: user.household.id, name: user.household.name }, unreadNotifications };
}

export async function updateMe(auth: AuthUser, input: z.infer<typeof updateMeSchema>) {
  const data: { name?: string; color?: string; passwordHash?: string } = {};
  if (input.name) data.name = input.name;
  if (input.color) data.color = input.color;
  if (input.newPassword) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.id } });
    if (!(await verifyPassword(input.currentPassword ?? '', user.passwordHash))) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'הסיסמה הנוכחית שגויה', [{ field: 'currentPassword', message: 'סיסמה שגויה' }]);
    }
    data.passwordHash = await hashPassword(input.newPassword);
  }
  const user = await prisma.user.update({ where: { id: auth.id }, data });
  return publicUser(user);
}
