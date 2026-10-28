import type { AuthUser } from './types';

// טבלת ההרשאות במקום אחד. השרת בודק אותה בכל פעולה.
export type Action =
  | 'recipe:write'
  | 'pantry:markInStock'
  | 'pantry:markOut'
  | 'menu:write'
  | 'shopping:addDirect'
  | 'shopping:review'
  | 'shopping:delete'
  | 'tasks:manage'
  | 'tasks:seeAll'
  | 'household:manage'
  | 'ingredients:write';

const MEMBER_ALLOWED: Action[] = ['pantry:markOut'];

export const isManager = (u: AuthUser) => u.role === 'MANAGER';

/** can: מותר או אסור, לפי התפקיד */
export function can(user: AuthUser, action: Action): boolean {
  if (isManager(user)) return true;
  return MEMBER_ALLOWED.includes(action);
}
