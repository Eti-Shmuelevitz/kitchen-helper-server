import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, options);
}

/** מחזיר את מזהה המשתמשת, או null אם הטוקן לא תקין או פג */
export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null && typeof decoded.sub === 'string') return decoded.sub;
    return null;
  } catch {
    return null;
  }
}
