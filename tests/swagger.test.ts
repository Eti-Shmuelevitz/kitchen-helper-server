import { describe, expect, it } from 'vitest';
import { api, app, auth } from './helpers';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import request from 'supertest';

type Layer = { route?: { path: string; methods: Record<string, boolean> }; name: string; handle: { stack?: Layer[] }; regexp: RegExp };

describe('Swagger, בריאות ושגיאות', () => {
  it('GET /api/health מחזיר ok', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('/api-docs נפתח, וקובץ OpenAPI 3 עם Bearer JWT', async () => {
    const page = await api().get('/api-docs/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('swagger');
    const res = await api().get('/api-docs.json');
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(res.body.paths['/api/auth/login'].post.security).toEqual([]);
  });

  it('כל נתיב שקיים בשרת מתועד ב־Swagger', async () => {
    const doc = (await api().get('/api-docs.json')).body;
    const documented = new Set<string>();
    for (const [p, methods] of Object.entries(doc.paths as Record<string, Record<string, unknown>>)) {
      for (const m of Object.keys(methods)) documented.add(`${m.toUpperCase()} ${p.replace(/\{(\w+)\}/g, ':$1')}`);
    }
    const found: string[] = [];
    const prefixOf = (re: RegExp) =>
      re.source
        .replace('^\\', '')
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace('(?:/(?=$))?(?=/|$)', '');
    const walk = (stack: Layer[], prefix: string) => {
      for (const l of stack) {
        if (l.route) {
          for (const m of Object.keys(l.route.methods)) found.push(`${m.toUpperCase()} ${prefix}${l.route.path}`.replace(/\/$/, ''));
        } else if (l.name === 'router' && l.handle.stack) {
          walk(l.handle.stack, prefix + prefixOf(l.regexp));
        }
      }
    };
    walk((app as unknown as { _router: { stack: Layer[] } })._router.stack, '');
    const routes = found.filter((r) => r.includes('/api/') && !r.includes('api-docs'));
    expect(routes.length).toBeGreaterThan(45);
    expect(routes.filter((r) => !documented.has(r))).toEqual([]);
    // וגם להפך: אין ב־Swagger נתיב שלא קיים
    expect([...documented].filter((d) => !routes.includes(d))).toEqual([]);
  });

  it('כתובת שלא קיימת → 404 בעברית, JSON שבור → 400', async () => {
    const res = await api().get('/api/nothing').set(await auth('member'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(bad.status).toBe(400);
  });

  it('CORS: רק הכתובת שהוגדרה', async () => {
    const ok = await api().get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const no = await api().get('/api/health').set('Origin', 'http://evil.example');
    expect(no.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('האתר סגור בשבת', () => {
  it('בשבת: 503 עם שעת היציאה, ו־/api/health ממשיך לעבוד', async () => {
    const prev = env.SHABBAT_GUARD;
    env.SHABBAT_GUARD = true;
    try {
      // שבת פרשת לך־לך, 12:00 בצהריים
      const shabbatApp = createApp({ now: () => new Date('2026-10-24T09:00:00Z') });
      const res = await request(shabbatApp).post('/api/auth/login').send({ email: 'manager@example.com', password: 'Manager123' });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatchObject({ code: 'SHABBAT', message: 'שבת שלום! האתר סגור עד צאת השבת', details: { reopensAtLocal: '18:34' } });
      expect((await request(shabbatApp).get('/api/health')).status).toBe(200);

      // יום חול: עובד כרגיל
      const weekday = createApp({ now: () => new Date('2026-10-20T09:00:00Z') });
      expect((await request(weekday).get('/api/recipes').set(await auth('member'))).status).toBe(200);
    } finally {
      env.SHABBAT_GUARD = prev;
    }
  });
});
