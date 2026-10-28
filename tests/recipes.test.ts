import { describe, expect, it } from 'vitest';
import { api, auth, prisma, refs } from './helpers';

// PNG קטן ותקין (1x1)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('מתכונים', () => {
  it('רשימה עם שדות מחושבים, ובן משפחה לא רואה ארכיון', async () => {
    const res = await api().get('/api/recipes').set(await auth('member'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    const cake = res.body.items.find((r: { name: string }) => r.name === 'עוגת שוקולד');
    expect(cake).toMatchObject({ canMakeNow: false, missing: ['שוקולד מריר'], match: { have: 5, total: 6, percent: 83 } });
    expect(res.body.items.some((r: { status: string }) => r.status === 'ARCHIVED')).toBe(false);
    // גם אם בן משפחה מבקש ארכיון, הוא מקבל רק פעילים
    const arch = await api().get('/api/recipes?status=ARCHIVED').set(await auth('member'));
    expect(arch.body.items.every((r: { status: string }) => r.status === 'ACTIVE')).toBe(true);
    const mgr = await api().get('/api/recipes?status=ARCHIVED').set(await auth('manager'));
    expect(mgr.body.items.map((r: { name: string }) => r.name)).toEqual(['מוקפץ ירקות']);
  });

  it('חיפוש, סינון ומיון', async () => {
    const h = await auth('manager');
    const q = await api().get('/api/recipes').query({ q: 'עוף' }).set(h);
    expect(q.body.items.map((r: { name: string }) => r.name).sort()).toEqual(['מרק עוף', 'עוף בתנור', 'שניצל עוף']);

    const meat = await api().get('/api/recipes').query({ kosherType: 'MEAT', shabbatFriendly: 'true' }).set(h);
    expect(meat.body.items.every((r: { kosherType: string; shabbatFriendly: boolean }) => r.kosherType === 'MEAT' && r.shabbatFriendly)).toBe(true);

    const ready = await api().get('/api/recipes').query({ ready: 'true' }).set(h);
    expect(ready.body.items.length).toBeGreaterThan(0);
    expect(ready.body.items.every((r: { canMakeNow: boolean }) => r.canMakeNow)).toBe(true);

    const quick = await api().get('/api/recipes').query({ maxMinutes: 25, sort: 'prepMinutes' }).set(h);
    const mins = quick.body.items.map((r: { prepMinutes: number }) => r.prepMinutes);
    expect(mins.every((m: number) => m <= 25)).toBe(true);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));

    const byVotes = await api().get('/api/recipes').query({ sort: 'votes' }).set(h);
    expect(byVotes.body.items[0].name).toBe('שניצל עוף');

    const paged = await api().get('/api/recipes').query({ pageSize: 5, page: 3 }).set(h);
    expect(paged.body).toMatchObject({ total: 12, totalPages: 3 });
    expect(paged.body.items).toHaveLength(2);

    const bad = await api().get('/api/recipes').query({ sort: 'color' }).set(h);
    expect(bad.status).toBe(400);
  });

  it('מתכון בודד: כמויות לפי מספר מנות, ״לפי הטעם״ ו״דורש בדיקה״', async () => {
    const { recipe } = await refs();
    const salad = await recipe('סלט ירקות');
    const res = await api().get(`/api/recipes/${salad.id}?servings=8`).set(await auth('member'));
    expect(res.status).toBe(200);
    expect(res.body.scaledServings).toBe(8);
    const tomatoes = res.body.ingredients.find((i: { name: string }) => i.name === 'עגבניות');
    expect(tomatoes.quantity).toBe(6);
    const salt = res.body.ingredients.find((i: { name: string }) => i.name === 'מלח');
    expect(salt.toTaste).toBe(true);
    const parsley = res.body.ingredients.find((i: { name: string }) => i.name === 'פטרוזיליה');
    expect(parsley).toMatchObject({ isOptional: true, needsInspection: true });
    expect(res.body.steps[0].order).toBe(1);
  });

  it('מנהלת מוסיפה ועורכת מתכון. בן משפחה מקבל 403', async () => {
    const { ingredient } = await refs();
    const eggs = await ingredient('ביצים');
    const onion = await ingredient('בצל');
    const body = {
      name: 'חביתה',
      description: 'חביתה עם בצל',
      category: 'BREAKFAST',
      kosherType: 'PAREVE',
      difficulty: 'EASY',
      prepMinutes: 10,
      servings: 2,
      ingredients: [
        { ingredientId: eggs.id, quantity: 3 },
        { ingredientId: onion.id, quantity: 0.5 },
      ],
      steps: [{ text: 'מטגנים את הבצל' }, { text: 'מוסיפים ביצים טרופות', timerMinutes: 3 }],
    };
    expect((await api().post('/api/recipes').set(await auth('member')).send(body)).status).toBe(403);

    const h = await auth('manager');
    const created = await api().post('/api/recipes').set(h).send(body);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'חביתה', canMakeNow: true, status: 'ACTIVE' });
    expect(created.body.ingredients[0].unit).toBeTruthy();

    // אותו שם → 409
    expect((await api().post('/api/recipes').set(h).send(body)).status).toBe(409);

    const edited = await api()
      .put(`/api/recipes/${created.body.id}`)
      .set(h)
      .send({ ...body, name: 'חביתה עם בצל', servings: 4, steps: [{ text: 'הכול במחבת אחת', timerMinutes: 5 }] });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ name: 'חביתה עם בצל', servings: 4 });
    expect(edited.body.steps).toHaveLength(1);

    const arch = await api().patch(`/api/recipes/${created.body.id}/status`).set(h).send({ status: 'ARCHIVED' });
    expect(arch.body.status).toBe('ARCHIVED');
  });

  it('ולידציה: שדות חסרים', async () => {
    const h = await auth('manager');
    const empty = await api().post('/api/recipes').set(h).send({ name: 'א' });
    expect(empty.status).toBe(400);
    const fields = empty.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'category', 'kosherType', 'ingredients', 'steps']));

    const base = { category: 'MAIN', kosherType: 'PAREVE', difficulty: 'EASY', prepMinutes: 20, servings: 4, steps: [{ text: 'מבשלים' }] };
    const noName = await api().post('/api/recipes').set(h).send({ ...base, name: 'בלי שם מצרך', ingredients: [{ quantity: 1 }] });
    expect(noName.status).toBe(400);
  });

  it('מצרכים בשם חופשי: מצרך קיים נמצא לפי השם, ומצרך חדש נוצר. אין בדיקת כשרות לפי המצרכים', async () => {
    const h = await auth('manager');
    const res = await api()
      .post('/api/recipes')
      .set(h)
      .send({
        name: 'עוגת קמח מלא',
        category: 'BAKED',
        kosherType: 'PAREVE',
        difficulty: 'EASY',
        prepMinutes: 50,
        servings: 8,
        ingredients: [
          { name: 'ביצים', quantity: 3 },
          { name: 'קמח מלא', quantity: 2, unit: 'כוסות' },
          { name: 'גבינה צהובה', quantity: 1 },
        ],
        steps: [{ text: 'מערבבים הכול' }, { text: 'אופים' }],
      });
    expect(res.status).toBe(201);
    expect(res.body.kosherType).toBe('PAREVE');
    const flour = res.body.ingredients.find((i: { name: string }) => i.name === 'קמח מלא');
    expect(flour).toMatchObject({ quantity: 2, unit: 'כוסות' });

    // המצרך החדש נשמר ברשימת המצרכים של הבית, והמצרך הקיים לא שוכפל
    const all = await prisma.ingredient.findMany({ where: { name: { in: ['קמח מלא', 'ביצים'] }, household: { name: 'משפחת כהן' } } });
    expect(all.map((i) => i.name).sort()).toEqual(['ביצים', 'קמח מלא']);

    // אותו מצרך פעמיים → 400
    const dup = await api()
      .post('/api/recipes')
      .set(h)
      .send({ name: 'כפול', category: 'MAIN', kosherType: 'PAREVE', difficulty: 'EASY', prepMinutes: 5, servings: 1, ingredients: [{ name: 'ביצים', quantity: 1 }, { name: 'ביצים', quantity: 2 }], steps: [{ text: 'מבשלים' }] });
    expect(dup.status).toBe(400);
  });

  it('משפחה אחרת לא רואה ולא משנה את המתכונים של הבית', async () => {
    const { recipe } = await refs();
    const s = await recipe('שקשוקה');
    const other = await auth('other');
    expect((await api().get(`/api/recipes/${s.id}`).set(other)).status).toBe(404);
    expect((await api().patch(`/api/recipes/${s.id}/status`).set(other).send({ status: 'ARCHIVED' })).status).toBe(404);
    const list = await api().get('/api/recipes').set(other);
    expect(list.body.items.map((r: { name: string }) => r.name)).toEqual(['שקשוקה של לוי']);
  });

  it('הצבעות ומועדפים', async () => {
    const { recipe } = await refs();
    const kugel = await recipe('קוגל תפוחי אדמה');
    const h = await auth('member2');
    const v = await api().post(`/api/recipes/${kugel.id}/vote`).set(h);
    expect(v.status).toBe(201);
    expect(v.body.votesThisWeek).toBe(1);
    expect((await api().post(`/api/recipes/${kugel.id}/vote`).set(h)).status).toBe(409);
    expect((await api().delete(`/api/recipes/${kugel.id}/vote`).set(h)).body.votesThisWeek).toBe(0);

    expect((await api().post(`/api/recipes/${kugel.id}/favorite`).set(h)).status).toBe(204);
    const favs = await api().get('/api/recipes?favorites=true').set(h);
    expect(favs.body.items.map((r: { name: string }) => r.name)).toContain('קוגל תפוחי אדמה');
    expect((await api().delete(`/api/recipes/${kugel.id}/favorite`).set(h)).status).toBe(204);
  });

  it('הגלגל מחזיר עד 10 מתכונים, ״ממה שיש״ רק כאלה שחסר להם לכל היותר מצרך אחד', async () => {
    const res = await api().get('/api/recipes/wheel?mode=ready').set(await auth('member'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(1);
    expect(res.body.items.length).toBeLessThanOrEqual(10);
    expect(res.body.items.every((r: { missing: string[] }) => r.missing.length <= 1)).toBe(true);
  });

  it('תמונה: רק JPG/PNG, נשמרת ומוצגת בלי token', async () => {
    const { recipe } = await refs();
    const r = await recipe('פתיתים');
    const h = await auth('manager');
    const bad = await api().post(`/api/recipes/${r.id}/image`).set(h).attach('image', Buffer.from('not an image'), 'x.png');
    expect(bad.status).toBe(400);
    const ok = await api().post(`/api/recipes/${r.id}/image`).set(h).attach('image', PNG, 'pic.png');
    expect(ok.status).toBe(200);
    expect(ok.body.imageUrl).toContain(`/api/recipes/${r.id}/image`);
    const img = await api().get(`/api/recipes/${r.id}/image`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect((await api().post(`/api/recipes/${r.id}/image`).set(await auth('member')).attach('image', PNG, 'pic.png')).status).toBe(403);
  });
});
