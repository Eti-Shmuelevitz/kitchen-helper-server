import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { resetRateLimits } from '../src/middleware/rateLimit';

export const app = createApp();
export const api = () => request(app);
export { prisma };

export const USERS = {
  manager: { email: 'manager@example.com', password: 'Manager123' },
  member: { email: 'member@example.com', password: 'Member123' },
  member2: { email: 'member2@example.com', password: 'Member123' },
  other: { email: 'other@example.com', password: 'Other1234' },
} as const;

const cache = new Map<string, string>();

export async function tokenFor(who: keyof typeof USERS): Promise<string> {
  const hit = cache.get(who);
  if (hit) return hit;
  resetRateLimits();
  const res = await api().post('/api/auth/login').send(USERS[who]);
  if (res.status !== 200) throw new Error(`login failed for ${who}: ${res.status} ${JSON.stringify(res.body)}`);
  cache.set(who, res.body.token);
  return res.body.token as string;
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

export async function auth(who: keyof typeof USERS) {
  return bearer(await tokenFor(who));
}

/** מזהים מנתוני ההדגמה, לפי שם */
export async function refs() {
  const cohen = await prisma.household.findUniqueOrThrow({ where: { inviteCode: 'KITCHEN1' } });
  const recipe = (name: string) => prisma.recipe.findFirstOrThrow({ where: { householdId: cohen.id, name } });
  const ingredient = (name: string) => prisma.ingredient.findFirstOrThrow({ where: { householdId: cohen.id, name } });
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });
  return { cohen, recipe, ingredient, user };
}

/** תאריך YYYY-MM-DD לפי שעון ישראל, כמו בשרת */
export function isoDaysFromToday(n: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** תאריך של יום מסוים בשבוע הבא (0 = ראשון ... 6 = שבת), כדי שהבדיקות לא יהיו תלויות ביום הנוכחי */
export function nextWeekDay(dow: number): string {
  const today = isoDaysFromToday(0);
  const cur = new Date(`${today}T00:00:00Z`).getUTCDay();
  return isoDaysFromToday(7 - cur + dow);
}
