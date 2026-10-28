import { describe, expect, it } from 'vitest';
import { api, auth, isoDaysFromToday, nextWeekDay, prisma, refs } from './helpers';

describe('מלאי', () => {
  it('מלאי לפי מחלקות', async () => {
    const res = await api().get('/api/pantry').set(await auth('member'));
    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(6);
    expect(res.body.groups[0]).toMatchObject({ category: 'PRODUCE', label: 'ירקות ופירות' });
  });

  it('בן משפחה מסמן ״נגמר״ והמצרך נכנס לרשימת הקניות, אבל לא יכול לסמן ״יש״', async () => {
    const { ingredient } = await refs();
    const cucumber = await ingredient('מלפפונים');
    const h = await auth('member');
    const out = await api().patch(`/api/pantry/${cucumber.id}`).set(h).send({ inStock: false });
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ inStock: false, addedToShopping: true });
    // פעם שנייה לא מוסיפה שורה כפולה
    expect((await api().patch(`/api/pantry/${cucumber.id}`).set(h).send({ inStock: false })).body.addedToShopping).toBe(false);
    expect((await api().patch(`/api/pantry/${cucumber.id}`).set(h).send({ inStock: true })).status).toBe(403);
    expect((await api().patch(`/api/pantry/${cucumber.id}`).set(await auth('manager')).send({ inStock: true })).status).toBe(200);
  });

  it('מצרך חדש: רק מנהלת, ושם כפול → 409', async () => {
    const body = { name: 'חציל', category: 'PRODUCE', unit: 'יח׳' };
    expect((await api().post('/api/ingredients').set(await auth('member')).send(body)).status).toBe(403);
    const h = await auth('manager');
    const res = await api().post('/api/ingredients').set(h).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'חציל', inStock: false, kosherType: 'PAREVE' });
    expect((await api().post('/api/ingredients').set(h).send(body)).status).toBe(409);
    const edit = await api().patch(`/api/ingredients/${res.body.id}`).set(h).send({ needsInspection: true });
    expect(edit.body.needsInspection).toBe(true);
    const search = await api().get('/api/ingredients').query({ q: 'חצ' }).set(h);
    expect(search.body.map((i: { name: string }) => i.name)).toEqual(['חציל']);
  });
});

describe('תפריט שבועי', () => {
  it('שבוע עם תאריך עברי, פרשה וסעודות שבת', async () => {
    const res = await api().get('/api/menu').set(await auth('member'));
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(7);
    const sat = res.body.days[6];
    expect(sat.isShabbat).toBe(true);
    expect(sat.meals.map((m: { meal: string }) => m.meal).slice(0, 3)).toEqual(['SHABBAT_NIGHT', 'SHABBAT_DAY', 'SEUDA_SHLISHIT']);
    expect(sat.meals[0].entries.length).toBe(3);
    expect(res.body.days[0].hebrewDate).toMatch(/תשפ/);
  });

  it('שיבוץ, גרירה ומחיקה. סעודת שבת רק בשבת', async () => {
    const { recipe } = await refs();
    const h = await auth('manager');
    const schnitzel = await recipe('שניצל עוף');
    const tuesday = nextWeekDay(2);
    const add = await api().post('/api/menu').set(h).send({ date: tuesday, meal: 'DINNER', recipeId: schnitzel.id });
    expect(add.status).toBe(201);
    expect(add.body).toMatchObject({ date: tuesday, meal: 'DINNER', servings: 4, mixed: false, mealEntries: 1 });

    // סימון ״ארוחה מעורבת״ כשמוסיפים מנה חלבית לאותה ארוחה
    const pashtida = await recipe('פשטידת גבינות');
    const mixed = await api().post('/api/menu').set(h).send({ date: tuesday, meal: 'DINNER', recipeId: pashtida.id });
    expect(mixed.body.mixed).toBe(true);

    // גרירה ליום אחר
    const wednesday = nextWeekDay(3);
    const moved = await api().patch(`/api/menu/${mixed.body.id}`).set(h).send({ date: wednesday, meal: 'LUNCH' });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ date: wednesday, meal: 'LUNCH', mixed: false });

    const wrong = await api().post('/api/menu').set(h).send({ date: tuesday, meal: 'SHABBAT_DAY', recipeId: schnitzel.id });
    expect(wrong.status).toBe(400);
    const satWeekday = await api().post('/api/menu').set(h).send({ date: nextWeekDay(6), meal: 'DINNER', recipeId: schnitzel.id });
    expect(satWeekday.status).toBe(400);

    const week = await api().get(`/api/menu?week=${tuesday}`).set(h);
    expect(week.body.weekStart).toBe(nextWeekDay(0));
    expect(week.body.days[2].meals.find((m: { meal: string }) => m.meal === 'DINNER').entries).toHaveLength(1);

    expect((await api().delete(`/api/menu/${add.body.id}`).set(h)).status).toBe(204);
    expect((await api().delete(`/api/menu/${add.body.id}`).set(h)).status).toBe(404);
  });

  it('בן משפחה לא משנה את התפריט, ומתכון בארכיון לא משובץ', async () => {
    const { recipe } = await refs();
    const r = await recipe('אורז לבן');
    expect((await api().post('/api/menu').set(await auth('member')).send({ date: nextWeekDay(1), meal: 'DINNER', recipeId: r.id })).status).toBe(403);
    const archived = await recipe('מוקפץ ירקות');
    expect((await api().post('/api/menu').set(await auth('manager')).send({ date: nextWeekDay(1), meal: 'DINNER', recipeId: archived.id })).status).toBe(409);
    expect((await api().post('/api/menu').set(await auth('manager')).send({ date: '2026-02-30', meal: 'DINNER', recipeId: r.id })).status).toBe(400);
  });

  it('לוח עברי לשבוע', async () => {
    const res = await api().get('/api/calendar/week?date=2026-10-22').set(await auth('member'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ weekStart: '2026-10-18', parasha: 'פרשת לך־לך' });
    expect(res.body.candleLighting[0]).toMatchObject({ date: '2026-10-23', local: '17:18' });
  });
});

describe('רשימת קניות', () => {
  it('רשימה אוטומטית מהתפריט של שבוע הבא, פחות מה שיש בבית', async () => {
    const { recipe } = await refs();
    const h = await auth('manager');
    const cake = await recipe('עוגת שוקולד');
    await api().post('/api/menu').set(h).send({ date: nextWeekDay(4), meal: 'DINNER', recipeId: cake.id, servings: 24 });
    const res = await api().get(`/api/shopping?week=${nextWeekDay(0)}`).set(h);
    expect(res.status).toBe(200);
    const items = res.body.groups.flatMap((g: { items: unknown[] }) => g.items);
    const choc = items.find((i: { name: string }) => i.name === 'שוקולד מריר');
    expect(choc).toMatchObject({ source: 'AUTO', status: 'OPEN', quantity: 200, forRecipes: ['עוגת שוקולד'] });
    // מצרך שיש בבית (קמח) לא נכנס
    expect(items.some((i: { name: string }) => i.name === 'קמח')).toBe(false);
  });

  it('בן משפחה שולח בקשה, מנהלת מאשרת, ושני הצדדים מקבלים התראה', async () => {
    const member = await auth('member');
    const manager = await auth('manager');
    const req = await api().post('/api/shopping').set(member).send({ name: 'גבינה לבנה 5%', category: 'DAIRY' });
    expect(req.status).toBe(201);
    expect(req.body).toMatchObject({ source: 'REQUEST', status: 'PENDING' });

    const notif = await api().get('/api/notifications?unreadOnly=true').set(manager);
    expect(notif.body.items.some((n: { text: string }) => n.text.includes('גבינה לבנה 5%'))).toBe(true);

    // בן משפחה לא מאשר
    expect((await api().patch(`/api/shopping/${req.body.id}/review`).set(member).send({ action: 'approve' })).status).toBe(403);
    const ok = await api().patch(`/api/shopping/${req.body.id}/review`).set(manager).send({ action: 'approve' });
    expect(ok.body.status).toBe('OPEN');
    // אישור כפול → 409
    expect((await api().patch(`/api/shopping/${req.body.id}/review`).set(manager).send({ action: 'decline' })).status).toBe(409);

    const mine = await api().get('/api/notifications').set(member);
    expect(mine.body.items[0].type).toBe('REQUEST_APPROVED');
    expect((await api().patch('/api/notifications/read').set(member).send({})).status).toBe(204);
    expect((await api().get('/api/notifications').set(member)).body.unreadCount).toBe(0);
  });

  it('בן משפחה רואה רק את הבקשות שלו, מנהלת רואה את כולן', async () => {
    const { user } = await refs();
    const yossi = await user('member@example.com');
    const mine = await api().get('/api/shopping/requests').set(await auth('member'));
    expect(mine.body.length).toBeGreaterThan(0);
    expect(mine.body.every((r: { requestedBy: { id: string } }) => r.requestedBy.id === yossi.id)).toBe(true);
    const all = await api().get('/api/shopping/requests').set(await auth('manager'));
    expect(all.body.length).toBeGreaterThan(mine.body.length);
  });

  it('״קניתי״ ו״סיימתי לקנות״ מעבירים מצרכים למלאי בפעולה אחת', async () => {
    const { ingredient } = await refs();
    const h = await auth('member2');
    const pepper = await ingredient('פלפל אדום');
    // פלפל אדום חסר לשקשוקה שבתפריט השבוע (אם השקשוקה עוד לפנינו) או שנוסיף אותו ידנית
    const manual = await api().post('/api/shopping').set(await auth('manager')).send({ name: 'פלפל אדום', category: 'PRODUCE', quantity: 2 });
    expect(manual.body).toMatchObject({ source: 'MANUAL', status: 'OPEN', ingredientId: pepper.id });

    const yeast = await ingredient('שמרים');
    const b1 = await api().patch('/api/shopping/bought').set(h).send({ itemId: manual.body.id, bought: true });
    expect(b1.body.status).toBe('BOUGHT');
    const b2 = await api().patch('/api/shopping/bought').set(h).send({ ingredientId: yeast.id, bought: true });
    expect(b2.body).toMatchObject({ source: 'AUTO', status: 'BOUGHT' });
    expect((await api().patch('/api/shopping/bought').set(h).send({ bought: true })).status).toBe(400);

    const fin = await api().post('/api/shopping/finish').set(h).send({});
    expect(fin.status).toBe(200);
    expect(fin.body.movedToPantry).toBeGreaterThanOrEqual(2);
    const pantry = await prisma.pantryItem.findMany({ where: { ingredientId: { in: [pepper.id, yeast.id] } } });
    expect(pantry.every((p) => p.inStock)).toBe(true);
    expect(await prisma.shoppingItem.count({ where: { id: manual.body.id } })).toBe(0);

    const shakshuka = await api().get('/api/recipes?q=שקשוקה').set(h);
    expect(shakshuka.body.items[0].canMakeNow).toBe(true);
  });
});

describe('משימות ומשק הבית', () => {
  it('מנהלת יוצרת משימה, בן משפחה רואה רק את שלו ומסמן ״סיימתי״', async () => {
    const { user } = await refs();
    const shira = await user('member2@example.com');
    const manager = await auth('manager');
    const task = await api().post('/api/tasks').set(manager).send({ title: 'לבחור ירקות לסלט', assignedToId: shira.id, dueDate: isoDaysFromToday(1) });
    expect(task.status).toBe(201);
    expect(task.body.assignedTo.id).toBe(shira.id);

    const yossiTasks = await api().get('/api/tasks').set(await auth('member'));
    expect(yossiTasks.body.items.every((t: { assignedTo: { name: string } }) => t.assignedTo.name === 'יוסי')).toBe(true);
    // גם אם מבקש משימות של מישהו אחר
    const sneaky = await api().get(`/api/tasks?assignedTo=${shira.id}`).set(await auth('member'));
    expect(sneaky.body.items.some((t: { assignedTo: { id: string } }) => t.assignedTo.id === shira.id)).toBe(false);

    // יוסי לא יכול לסמן משימה של שירה
    expect((await api().patch(`/api/tasks/${task.body.id}/toggle`).set(await auth('member'))).status).toBe(403);
    const done = await api().patch(`/api/tasks/${task.body.id}/toggle`).set(await auth('member2'));
    expect(done.body.status).toBe('DONE');

    const stars = await api().get('/api/tasks/stars').set(await auth('member'));
    expect(stars.body[0]).toMatchObject({ name: expect.stringContaining('שירה'), stars: 3 });

    const all = await api().get('/api/tasks?status=DONE').set(manager);
    expect(all.body.total).toBeGreaterThanOrEqual(4);
    expect((await api().post('/api/tasks').set(await auth('member')).send({ title: 'משהו', assignedToId: shira.id })).status).toBe(403);
    expect((await api().post('/api/tasks').set(manager).send({ title: 'א', assignedToId: shira.id })).status).toBe(400);
  });

  it('מנהלת עורכת ומוחקת משימה. משימה לבן בית ממשפחה אחרת → 400', async () => {
    const { user } = await refs();
    const yossi = await user('member@example.com');
    const leah = await user('other@example.com');
    const h = await auth('manager');
    expect((await api().post('/api/tasks').set(h).send({ title: 'משימה', assignedToId: leah.id })).status).toBe(400);
    const t = await api().post('/api/tasks').set(h).send({ title: 'להוציא זבל', assignedToId: yossi.id });
    const edited = await api().patch(`/api/tasks/${t.body.id}`).set(h).send({ title: 'להוציא את הזבל', dueDate: isoDaysFromToday(-1) });
    expect(edited.body).toMatchObject({ title: 'להוציא את הזבל', isOverdue: true });
    expect((await api().delete(`/api/tasks/${t.body.id}`).set(await auth('member'))).status).toBe(403);
    // מנהלת של בית אחר לא מוצאת את המשימה בכלל
    expect((await api().delete(`/api/tasks/${t.body.id}`).set(await auth('other'))).status).toBe(404);
    expect((await api().delete(`/api/tasks/${t.body.id}`).set(h)).status).toBe(204);
  });

  it('משימות קבועות לערב שבת: חלוקה פעם אחת בשבוע', async () => {
    const h = await auth('manager');
    const templates = await api().get('/api/task-templates').set(h);
    expect(templates.body).toHaveLength(4);
    const first = await api().post('/api/tasks/erev-shabbat').set(h).send({});
    expect(first.status).toBe(201);
    expect(first.body.created).toHaveLength(3); // לאחת אין ברירת מחדל
    expect(first.body.skipped[0].reason).toBe('לא נבחר למי');
    expect(first.body.created.every((t: { isErevShabbat: boolean }) => t.isErevShabbat)).toBe(true);

    const second = await api().post('/api/tasks/erev-shabbat').set(h).send({});
    expect(second.body.created).toHaveLength(0);

    const newT = await api().post('/api/task-templates').set(h).send({ title: 'לקנות פרחים לשבת', daysBeforeShabbat: 1 });
    expect(newT.body.dayLabel).toBe('יום חמישי');
    expect((await api().delete(`/api/task-templates/${newT.body.id}`).set(h)).status).toBe(204);
    expect((await api().get('/api/task-templates').set(await auth('member'))).status).toBe(403);
  });

  it('ניהול בני הבית וקוד הצטרפות', async () => {
    const h = await auth('manager');
    const house = await api().get('/api/household').set(h);
    expect(house.body.inviteCode).toBe('KITCHEN1');
    const memberView = await api().get('/api/household').set(await auth('member'));
    expect(memberView.body.inviteCode).toBeUndefined();
    expect((await api().get('/api/household/members').set(await auth('member'))).status).toBe(403);

    const members = await api().get('/api/household/members').set(h);
    expect(members.body).toHaveLength(3);
    const rachel = members.body.find((m: { role: string }) => m.role === 'MANAGER');
    // אי אפשר להוריד את המנהלת האחרונה, ואי אפשר להסיר את עצמך
    expect((await api().patch(`/api/household/members/${rachel.id}`).set(h).send({ role: 'MEMBER' })).status).toBe(409);
    expect((await api().delete(`/api/household/members/${rachel.id}`).set(h)).status).toBe(409);

    const { user } = await refs();
    const leah = await user('other@example.com');
    expect((await api().patch(`/api/household/members/${leah.id}`).set(h).send({ role: 'MEMBER' })).status).toBe(404);
  });

  it('דף הבית: מנהלת רואה בקשות, בן משפחה רואה משימות', async () => {
    const mgr = await api().get('/api/today').set(await auth('manager'));
    expect(mgr.status).toBe(200);
    expect(mgr.body.role).toBe('MANAGER');
    expect(mgr.body.hebrewDate).toMatch(/תשפ/);
    expect(Array.isArray(mgr.body.pendingRequests)).toBe(true);
    expect(mgr.body.topVoted[0].name).toBe('שניצל עוף');
    expect(mgr.body.readyNow.every((r: { canMakeNow: boolean }) => r.canMakeNow)).toBe(true);

    const mem = await api().get('/api/today').set(await auth('member'));
    expect(mem.body.role).toBe('MEMBER');
    expect(mem.body.pendingRequests).toBeUndefined();
    expect(mem.body.myOpenTasks.every((t: { assignedTo: { name: string } }) => t.assignedTo.name === 'יוסי')).toBe(true);
  });
});
