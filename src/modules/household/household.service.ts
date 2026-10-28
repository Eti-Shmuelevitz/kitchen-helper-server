import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import { isManager } from '../../auth/permissions';
import type { AuthUser } from '../../auth/types';
import { generateInviteCode } from '../../services/inviteCode';
import { publicUser } from '../../shared/serializers';
import { conflict, notFound } from '../../utils/httpError';
import { countStars } from '../../utils/kitchen';
import type { updateMemberSchema } from './household.schemas';

export async function getHousehold(user: AuthUser) {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: user.householdId }, include: { _count: { select: { users: true } } } });
  return { id: h.id, name: h.name, membersCount: h._count.users, ...(isManager(user) ? { inviteCode: h.inviteCode } : {}) };
}

export async function listMembers(user: AuthUser) {
  const [users, tasks] = await Promise.all([
    prisma.user.findMany({ where: { householdId: user.householdId }, orderBy: [{ role: 'asc' }, { name: 'asc' }] }),
    prisma.task.findMany({ where: { householdId: user.householdId, status: 'DONE' }, select: { assignedToId: true, status: true } }),
  ]);
  const stars = countStars(tasks);
  return users.map((u) => ({ ...publicUser(u), stars: stars[u.id] ?? 0 }));
}

async function memberOf(user: AuthUser, id: string) {
  const m = await prisma.user.findFirst({ where: { id, householdId: user.householdId } });
  if (!m) throw notFound('בן הבית לא נמצא');
  return m;
}

async function assertNotLastManager(householdId: string, userId: string) {
  const managers = await prisma.user.count({ where: { householdId, role: 'MANAGER', id: { not: userId } } });
  if (managers === 0) throw conflict('בבית צריכה להישאר לפחות מנהלת אחת');
}

export async function updateMember(user: AuthUser, id: string, input: z.infer<typeof updateMemberSchema>) {
  const m = await memberOf(user, id);
  if (m.role === 'MANAGER' && input.role === 'MEMBER') await assertNotLastManager(user.householdId, m.id);
  return publicUser(await prisma.user.update({ where: { id: m.id }, data: { role: input.role } }));
}

export async function removeMember(user: AuthUser, id: string) {
  const m = await memberOf(user, id);
  if (m.id === user.id) throw conflict('אי אפשר להסיר את עצמך מהבית');
  await prisma.user.delete({ where: { id: m.id } });
}

/** קוד חדש. הקוד הישן מפסיק לעבוד */
export async function regenerateInviteCode(user: AuthUser) {
  const inviteCode = await generateInviteCode();
  await prisma.household.update({ where: { id: user.householdId }, data: { inviteCode } });
  return { inviteCode };
}
