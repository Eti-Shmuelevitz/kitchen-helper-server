import { randomInt } from 'node:crypto';
import { prisma } from '../db/prisma';

// בלי אותיות ומספרים שקל לבלבל (O/0, I/1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** generateInviteCode: קוד הצטרפות אקראי של 8 תווים, שלא קיים כבר */
export async function generateInviteCode(): Promise<string> {
  for (;;) {
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    const exists = await prisma.household.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (!exists) return code;
  }
}
