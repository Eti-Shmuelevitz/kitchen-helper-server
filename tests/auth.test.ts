import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { resetRateLimits } from '../src/middleware/rateLimit';
import { api, auth, bearer, prisma } from './helpers';

describe('התחברות והרשמה', () => {
  it('כניסה תקינה מחזירה token ומשתמש בלי סיסמה', async () => {
    resetRateLimits();
    const res = await api().post('/api/auth/login').send({ email: 'manager@example.com', password: 'Manager123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ email: 'manager@example.com', role: 'MANAGER' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Manager123/);
  });

  it('סיסמה שגויה → 401', async () => {
    resetRateLimits();
    const res = await api().post('/api/auth/login').send({ email: 'manager@example.com', password: 'Wrong1234' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('5 ניסיונות שגויים → נעילה (429)', async () => {
    resetRateLimits();
    for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send({ email: 'member2@example.com', password: 'Wrong1234' });
    const res = await api().post('/api/auth/login').send({ email: 'member2@example.com', password: 'Member123' });
    expect(res.status).toBe(429);
    resetRateLimits();
  });

  it('בלי token → 401, token לא תקין → 401, token שפג תוקפו → 401', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(bearer('not-a-token'))).status).toBe(401);
    const expired = jwt.sign({ sub: '00000000-0000-0000-0000-000000000000' }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const res = await api().get('/api/auth/me').set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('פג');
  });

  it('GET /api/auth/me מחזיר את המשתמש ומשק הבית', async () => {
    const res = await api().get('/api/auth/me').set(await auth('member'));
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('יוסי');
    expect(res.body.household.name).toBe('משפחת כהן');
    expect(res.body.unreadNotifications).toBeGreaterThanOrEqual(1);
  });

  it('הרשמה כבן משפחה: מצטרף לבית המשותף ומחובר מיד', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'דוד', email: 'david@example.com', password: 'David1234', role: 'MEMBER' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.role).toBe('MEMBER');
    expect(res.body.household.name).toBe('משפחת כהן');
    const me = await api().get('/api/auth/me').set(bearer(res.body.token));
    expect(me.status).toBe(200);
    // רואה את המתכונים של הבית המשותף
    const recipes = await api().get('/api/recipes').set(bearer(res.body.token));
    expect(recipes.body.total).toBeGreaterThan(0);
    // ניקוי, כדי שבדיקות אחרות יראו את הבית כמו בנתוני ההדגמה
    await prisma.user.delete({ where: { email: 'david@example.com' } });
  });

  it('הרשמה כמנהלת: רק עם קוד המנהלת הנכון', async () => {
    const base = { name: 'מרים', email: 'miriam@example.com', password: 'Miriam123', role: 'MANAGER' };
    const noCode = await api().post('/api/auth/register').send(base);
    expect(noCode.status).toBe(400);
    expect(noCode.body.error.details[0].field).toBe('managerCode');
    const wrong = await api().post('/api/auth/register').send({ ...base, managerCode: '0000' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.message).toBe('קוד המנהלת שגוי');
    const ok = await api().post('/api/auth/register').send({ ...base, managerCode: '1357' });
    expect(ok.status).toBe(201);
    expect(ok.body.user.role).toBe('MANAGER');
    // מנהלת יכולה לבצע פעולות של מנהלת
    const house = await api().get('/api/household/members').set(bearer(ok.body.token));
    expect(house.status).toBe(200);
    await prisma.user.delete({ where: { email: 'miriam@example.com' } });
  });

  it('ולידציה בהרשמה: מייל קיים → 409, סיסמה חלשה ותפקיד חסר → 400', async () => {
    const dup = await api().post('/api/auth/register').send({ name: 'מישהו', email: 'manager@example.com', password: 'Abcd1234', role: 'MEMBER' });
    expect(dup.status).toBe(409);
    const weak = await api().post('/api/auth/register').send({ name: 'מישהו', email: 'x1@example.com', password: 'abcdefgh', role: 'MEMBER' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.some((d: { field: string }) => d.field === 'password')).toBe(true);
    const noRole = await api().post('/api/auth/register').send({ name: 'מישהו', email: 'x2@example.com', password: 'Abcd1234' });
    expect(noRole.status).toBe(400);
    expect(noRole.body.error.details.some((d: { field: string }) => d.field === 'role')).toBe(true);
  });

  it('עדכון פרטים: החלפת סיסמה דורשת את הסיסמה הנוכחית', async () => {
    const h = await auth('member2');
    expect((await api().patch('/api/auth/me').set(h).send({ newPassword: 'Shira9999' })).status).toBe(400);
    expect((await api().patch('/api/auth/me').set(h).send({ currentPassword: 'Wrong1234', newPassword: 'Shira9999' })).status).toBe(400);
    const ok = await api().patch('/api/auth/me').set(h).send({ name: 'שירה כהן', color: '#123456' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ name: 'שירה כהן', color: '#123456' });
  });
});
