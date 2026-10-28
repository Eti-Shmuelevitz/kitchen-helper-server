// תיעוד OpenAPI 3 לכל ה־API. מוצג ב־/api-docs ונשמר גם ב־docs/openapi.json
/* eslint-disable @typescript-eslint/no-explicit-any */

type Schema = Record<string, any>;
type Who = 'public' | 'all' | 'manager' | 'special';

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const arr = (s: Schema): Schema => ({ type: 'array', items: s });
const uuid = { type: 'string', format: 'uuid', example: '3f1c2a8e-6b2d-4c1e-9a7b-2d4e5f6a7b8c' };
const date = { type: 'string', format: 'date', example: '2026-10-22' };
const str = (example?: string, extra: Schema = {}): Schema => ({ type: 'string', ...(example ? { example } : {}), ...extra });
const int = (example?: number): Schema => ({ type: 'integer', ...(example !== undefined ? { example } : {}) });
const bool = { type: 'boolean' };
const obj = (properties: Schema, required: string[] = []): Schema => ({ type: 'object', properties, ...(required.length ? { required } : {}) });

const WHO_TEXT: Record<Who, string> = {
  public: 'פתוח, בלי התחברות.',
  all: 'כל משתמש מחובר (מנהלת הבית או בן משפחה). רואים רק נתונים של הבית שלהם.',
  manager: 'מנהלת הבית בלבד (MANAGER). בן משפחה יקבל 403.',
  special: 'ראו פירוט בתיאור.',
};

const ERR: Record<number, string> = {
  400: 'שדות חסרים או לא תקינים (VALIDATION_ERROR)',
  401: 'חסר Token, או שהוא לא תקין או פג (UNAUTHORIZED)',
  403: 'אין הרשאה לפעולה (FORBIDDEN)',
  404: 'לא נמצא, או שייך למשפחה אחרת (NOT_FOUND)',
  409: 'התנגשות: כפילות, או פעולה שכבר בוצעה (CONFLICT)',
  429: 'יותר מדי בקשות או ניסיונות כניסה (TOO_MANY_REQUESTS)',
  503: 'שבת או חג: האתר סגור עד צאת השבת (SHABBAT)',
};

interface Op {
  tag: string;
  summary: string;
  description?: string;
  who: Who;
  params?: string[];
  query?: Record<string, Schema & { description?: string }>;
  body?: Schema;
  bodyExample?: unknown;
  ok?: { status?: number; schema?: Schema; example?: unknown; description?: string; image?: boolean };
  errors?: number[];
  /** העלאת קובץ (multipart/form-data) בשדה image */
  upload?: boolean;
  /** בדיקת הבריאות פתוחה גם בשבת */
  openOnShabbat?: boolean;
}

function op(o: Op) {
  const parameters = [
    ...(o.params ?? []).map((name) => ({ name, in: 'path', required: true, schema: uuid })),
    ...Object.entries(o.query ?? {}).map(([name, s]) => {
      const { description, ...schema } = s;
      return { name, in: 'query', required: false, schema, description };
    }),
  ];
  const status = String(o.ok?.status ?? 200);
  const errors = new Set<number>(o.errors ?? []);
  if (o.who !== 'public') errors.add(401);
  if (o.who === 'manager' || o.who === 'special') errors.add(403);
  if (o.body || o.upload || o.params?.length || o.query) errors.add(400);
  if (!o.openOnShabbat) errors.add(503);
  const responses: Schema = {};
  if (status === '204') responses[status] = { description: o.ok?.description ?? 'בוצע בהצלחה, בלי תוכן' };
  else if (o.ok?.image)
    responses[status] = {
      description: 'קובץ התמונה',
      content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'image/png': { schema: { type: 'string', format: 'binary' } } },
    };
  else
    responses[status] = {
      description: o.ok?.description ?? 'הצלחה',
      content: { 'application/json': { schema: o.ok?.schema ?? { type: 'object' }, ...(o.ok?.example !== undefined ? { example: o.ok.example } : {}) } },
    };
  for (const e of [...errors].sort()) {
    responses[String(e)] = { description: ERR[e], content: { 'application/json': { schema: ref('Error') } } };
  }
  return {
    tags: [o.tag],
    summary: o.summary,
    description: `${o.description ? `${o.description}\n\n` : ''}**הרשאה:** ${WHO_TEXT[o.who]}`,
    ...(o.who === 'public' ? { security: [] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(o.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: o.body, ...(o.bodyExample !== undefined ? { example: o.bodyExample } : {}) } },
          },
        }
      : o.upload
        ? {
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: obj({ image: { type: 'string', format: 'binary', description: 'JPG או PNG, עד 2MB' } }, ['image']),
                },
              },
            },
          }
        : {}),
    responses,
  };
}

// ---------- סכמות ----------

const department = str('DAIRY', { enum: ['PRODUCE', 'DAIRY', 'MEAT', 'PANTRY', 'SPICES', 'FROZEN'], description: 'מחלקה בסופר' });
const kosher = str('PAREVE', { enum: ['MEAT', 'DAIRY', 'PAREVE'], description: 'בשרי / חלבי / פרווה' });
const category = str('BREAKFAST', { enum: ['MAIN', 'SIDE', 'SALAD', 'SOUP', 'DESSERT', 'BAKED', 'BREAKFAST', 'SHABBAT_HOLIDAY'] });
const difficulty = str('EASY', { enum: ['EASY', 'MEDIUM', 'HARD'] });
const meal = str('DINNER', {
  enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SHABBAT_NIGHT', 'SHABBAT_DAY', 'SEUDA_SHLISHIT', 'YOM_TOV'],
  description: 'סעודות שבת רק ביום שבת. סעודת חג רק ביום טוב',
});
const userBrief = obj({ id: uuid, name: str('יוסי'), color: str('#2c5c60') });
const nullable = (s: Schema): Schema => ({ ...s, nullable: true });
const paged = (item: Schema): Schema => obj({ total: int(12), page: int(1), pageSize: int(20), totalPages: int(1), items: arr(item) });

const schemas: Record<string, Schema> = {
  Error: obj(
    {
      error: obj(
        { code: str('FORBIDDEN'), message: str('רק מנהלת הבית יכולה לבצע את הפעולה הזו'), details: { description: 'פירוט שדות שגויים (400), או שעת צאת השבת (503)' } },
        ['code', 'message'],
      ),
    },
    ['error'],
  ),
  User: obj({
    id: uuid,
    name: str('רחל כהן'),
    email: str('manager@example.com'),
    role: str('MANAGER', { enum: ['MANAGER', 'MEMBER'] }),
    color: str('#2c5c60'),
    householdId: uuid,
    createdAt: str(undefined, { format: 'date-time' }),
  }),
  Ingredient: obj({
    id: uuid,
    name: str('עגבניות'),
    category: department,
    categoryLabel: str('ירקות ופירות'),
    unit: str('יח׳'),
    kosherType: kosher,
    needsInspection: { ...bool, description: 'דורש בדיקה מחרקים' },
    inStock: bool,
  }),
  RecipeCard: obj({
    id: uuid,
    name: str('שקשוקה'),
    description: nullable(str('שקשוקה ביתית בסיר אחד')),
    category,
    categoryLabel: str('ארוחת בוקר'),
    kosherType: kosher,
    kosherLabel: str('פרווה'),
    shabbatFriendly: bool,
    difficulty,
    difficultyLabel: str('קל'),
    prepMinutes: int(25),
    servings: int(4),
    color: nullable(str('#c2410c')),
    status: str('ACTIVE', { enum: ['ACTIVE', 'ARCHIVED'] }),
    imageUrl: nullable(str('/api/recipes/3f1c.../image?v=1729000000000')),
    match: obj({ have: int(6), total: int(7), percent: int(86) }),
    missing: arr(str('פלפל אדום')),
    canMakeNow: bool,
    votesThisWeek: int(2),
    votedByMe: bool,
    isFavorite: bool,
    createdAt: str(undefined, { format: 'date-time' }),
    updatedAt: str(undefined, { format: 'date-time' }),
  }),
  RecipeDetail: {
    allOf: [
      ref('RecipeCard'),
      obj({
        scaledServings: int(6),
        createdBy: nullable(obj({ id: uuid, name: str('רחל כהן') })),
        ingredients: arr(
          obj({
            ingredientId: uuid,
            name: str('ביצים'),
            category: department,
            quantity: { type: 'number', example: 9, description: 'כמות לפי scaledServings' },
            originalQuantity: { type: 'number', example: 6 },
            unit: str('יח׳'),
            isOptional: bool,
            toTaste: { ...bool, description: 'כמות 0 = לפי הטעם' },
            inStock: bool,
            needsInspection: bool,
          }),
        ),
        steps: arr(obj({ order: int(1), text: str('מטגנים בצל ופלפל'), timerMinutes: nullable(int(10)) })),
      }),
    ],
  },
  RecipeInput: obj(
    {
      name: str('שקשוקה'),
      description: nullable(str('שקשוקה ביתית בסיר אחד')),
      category,
      kosherType: kosher,
      shabbatFriendly: bool,
      difficulty,
      prepMinutes: int(25),
      servings: int(4),
      color: nullable(str('#c2410c')),
      status: str('ACTIVE', { enum: ['ACTIVE', 'ARCHIVED'], description: 'רק בעריכה (PUT)' }),
      ingredients: arr(
        obj(
          {
            name: str('קמח מלא', { description: 'שם חופשי. אם אין מצרך כזה בבית, הוא נוצר אוטומטית. צריך name או ingredientId' }),
            ingredientId: { ...uuid, description: 'במקום name: מצרך קיים לפי מזהה' },
            quantity: { type: 'number', example: 2, description: '0 = לפי הטעם' },
            unit: str('כוסות', { description: 'לא חובה. ברירת מחדל: היחידה של המצרך' }),
            isOptional: bool,
          },
          ['quantity'],
        ),
      ),
      steps: arr(obj({ text: str('מטגנים בצל ופלפל'), timerMinutes: nullable(int(10)) }, ['text'])),
    },
    ['name', 'category', 'kosherType', 'difficulty', 'prepMinutes', 'servings', 'ingredients', 'steps'],
  ),
  MenuEntry: obj({
    id: uuid,
    date,
    meal,
    servings: int(4),
    order: int(0),
    recipe: obj({ id: uuid, name: str('שקשוקה'), kosherType: kosher, color: nullable(str()), status: str('ACTIVE'), prepMinutes: int(25), imageUrl: nullable(str()) }),
    addedBy: nullable(obj({ id: uuid, name: str('רחל כהן') })),
  }),
  MenuEntryResult: {
    allOf: [ref('MenuEntry'), obj({ mealEntries: int(2), mixed: { ...bool, description: 'באותה ארוחה יש גם בשרי וגם חלבי (לתשומת לב)' } })],
  },
  DayInfo: obj({
    date,
    dayOfWeek: int(4),
    dayName: str('חמישי'),
    hebrewDate: str('י״א חשון תשפ״ז'),
    holidays: arr(str()),
    isYomTov: bool,
    isShabbat: bool,
    isToday: bool,
  }),
  TimeOfDay: obj({ at: str('2026-10-23T14:18:00.000Z', { format: 'date-time' }), local: str('17:18'), date }),
  ShoppingItem: obj({
    key: str('auto:3f1c...', { description: 'מזהה לשורה ברשימה. בפריט מהתפריט: auto:<ingredientId>' }),
    id: nullable(uuid),
    source: str('REQUEST', { enum: ['AUTO', 'MANUAL', 'REQUEST'] }),
    status: str('PENDING', { enum: ['PENDING', 'OPEN', 'BOUGHT', 'DECLINED'] }),
    name: str('שוקו'),
    category: department,
    quantity: nullable({ type: 'number', example: 2 }),
    unit: nullable(str('יח׳')),
    ingredientId: nullable(uuid),
    forRecipes: arr(str('שקשוקה')),
    requestedBy: nullable(obj({ id: uuid, name: str('יוסי') })),
    boughtBy: nullable(obj({ id: uuid, name: str('שירה') })),
    createdAt: str(undefined, { format: 'date-time' }),
  }),
  Task: obj({
    id: uuid,
    title: str('לקלף תפוחי אדמה לקוגל'),
    dueDate: nullable(date),
    isOverdue: bool,
    status: str('OPEN', { enum: ['OPEN', 'DONE'] }),
    completedAt: nullable(str(undefined, { format: 'date-time' })),
    isErevShabbat: bool,
    templateId: nullable(uuid),
    assignedTo: userBrief,
    createdBy: nullable(obj({ id: uuid, name: str('רחל כהן') })),
    createdAt: str(undefined, { format: 'date-time' }),
    updatedAt: str(undefined, { format: 'date-time' }),
  }),
  TaskTemplate: obj({
    id: uuid,
    title: str('להכין פלטה'),
    daysBeforeShabbat: int(0),
    dayLabel: str('יום שישי'),
    defaultAssignee: nullable(obj({ id: uuid, name: str('יוסי') })),
  }),
  Notification: obj({
    id: uuid,
    type: str('SHOPPING_REQUEST', { enum: ['SHOPPING_REQUEST', 'REQUEST_APPROVED', 'REQUEST_DECLINED', 'TASK_ASSIGNED', 'TASK_DONE'] }),
    text: str('יוסי ביקש/ה: שוקו'),
    link: nullable(str('/shopping')),
    isRead: bool,
    createdAt: str(undefined, { format: 'date-time' }),
  }),
};

const idParam = ['id'];

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {
    '/api/health': {
      get: op({
        tag: 'כללי',
        summary: 'בדיקת בריאות השרת ומסד הנתונים',
        description: 'עובד גם בשבת, כדי ששירות הענן לא יחשוב שהשרת נפל.',
        who: 'public',
        openOnShabbat: true,
        ok: { example: { status: 'ok', database: 'ok', time: '2026-10-19T12:00:00.000Z' } },
      }),
    },

    // ----- התחברות -----
    '/api/auth/register': {
      post: op({
        tag: 'התחברות',
        summary: 'הרשמה: בוחרים תפקיד. מנהלת הבית צריכה קוד מנהלת',
        description:
          'כל מי שנרשמת מצטרפת לבית המשותף ומחוברת מיד (חוזר token).\n\n' +
          '`role`: `MEMBER` (בן / בת משפחה) או `MANAGER` (מנהלת הבית). ב־`MANAGER` חובה `managerCode`, ' +
          'והוא צריך להתאים לקוד שבהגדרות השרת (`MANAGER_CODE`). קוד שגוי → 400.',
        who: 'public',
        body: obj(
          {
            name: str('יוסי'),
            email: str('yossi@example.com'),
            password: str('Yossi1234'),
            role: str('MEMBER', { enum: ['MANAGER', 'MEMBER'] }),
            managerCode: str('1357', { description: 'רק כש־role הוא MANAGER' }),
          },
          ['name', 'email', 'password', 'role'],
        ),
        bodyExample: { name: 'יוסי', email: 'yossi@example.com', password: 'Yossi1234', role: 'MEMBER' },
        ok: { status: 201, schema: obj({ token: str('eyJhbGciOiJIUzI1NiIs...'), user: ref('User'), household: obj({ id: uuid, name: str('משפחת כהן') }) }) },
        errors: [409, 429],
      }),
    },
    '/api/auth/login': {
      post: op({
        tag: 'התחברות',
        summary: 'כניסה. מחזיר JWT להעתקה לכפתור Authorize',
        description: '5 ניסיונות שגויים לאותו מייל → נעילה ל־15 דקות.',
        who: 'public',
        body: obj({ email: str('manager@example.com'), password: str('Manager123') }, ['email', 'password']),
        bodyExample: { email: 'manager@example.com', password: 'Manager123' },
        ok: { schema: obj({ token: str('eyJhbGciOiJIUzI1NiIs...'), user: ref('User') }) },
        errors: [429],
      }),
    },
    '/api/auth/me': {
      get: op({
        tag: 'התחברות',
        summary: 'המשתמש המחובר ומשק הבית שלו',
        who: 'all',
        ok: { schema: obj({ user: ref('User'), household: obj({ id: uuid, name: str('משפחת כהן') }), unreadNotifications: int(2) }) },
      }),
      patch: op({
        tag: 'התחברות',
        summary: 'עדכון שם, צבע וסיסמה (החלפת סיסמה דורשת את הסיסמה הנוכחית)',
        who: 'all',
        body: obj({ name: str('רחל'), color: str('#7a5ba8'), currentPassword: str('Manager123'), newPassword: str('NewPass99') }),
        ok: { schema: ref('User') },
      }),
    },

    // ----- דף הבית ולוח -----
    '/api/today': {
      get: op({
        tag: 'דף הבית',
        summary: 'כל הנתונים של דף ״היום״ בבקשה אחת',
        description:
          'מה מבשלים היום, ״אפשר להכין עכשיו״, ״חסר מצרך אחד״. מיום רביעי: פס ״לקראת שבת קודש״ (סעודות, מה חסר, משימות ערב שבת). ' +
          'למנהלת: בקשות שממתינות והמנות שהכי ביקשו השבוע. לבן משפחה: המשימות הפתוחות שלו.',
        who: 'all',
        ok: {
          schema: obj({
            date,
            dayName: str('שני'),
            hebrewDate: str('ח׳ חשון תשפ״ז'),
            role: str('MANAGER'),
            unreadNotifications: int(1),
            todayMenu: arr(ref('MenuEntry')),
            readyNow: arr(ref('RecipeCard')),
            missingOne: arr({ allOf: [ref('RecipeCard'), obj({ missingIngredient: str('פלפל אדום') })] }),
            shabbat: nullable(
              obj({
                date,
                hebrewDate: str(),
                parasha: nullable(str('פרשת לך־לך')),
                candleLighting: nullable(ref('TimeOfDay')),
                havdalah: nullable(ref('TimeOfDay')),
                meals: arr(obj({ meal, label: str('ליל שבת'), entries: arr(ref('MenuEntry')) })),
                missing: arr(obj({ ingredientId: uuid, name: str(), category: department, unit: str(), quantity: { type: 'number' }, forRecipes: arr(str()) })),
                shabbatFriendlySuggestions: arr(ref('RecipeCard')),
                tasks: arr(obj({ id: uuid, title: str(), status: str(), dueDate: nullable(date), assignedTo: userBrief })),
              }),
            ),
            pendingRequests: { ...arr(ref('ShoppingItem')), description: 'למנהלת בלבד' },
            topVoted: { ...arr(ref('RecipeCard')), description: 'למנהלת בלבד' },
            myOpenTasks: { ...arr(ref('Task')), description: 'לבן משפחה בלבד' },
          }),
        },
      }),
    },
    '/api/calendar/week': {
      get: op({
        tag: 'דף הבית',
        summary: 'לוח עברי לשבוע: תאריכים עבריים, פרשת השבוע, חגים, הדלקת נרות והבדלה (ירושלים)',
        who: 'all',
        query: { date: { ...date, description: 'כל תאריך בשבוע. ברירת מחדל: היום' } },
        ok: {
          schema: obj({
            weekStart: date,
            parasha: nullable(str('פרשת לך־לך')),
            days: arr(ref('DayInfo')),
            holidayDates: arr(date),
            candleLighting: arr(ref('TimeOfDay')),
            havdalah: arr(ref('TimeOfDay')),
          }),
        },
      }),
    },

    // ----- משק הבית -----
    '/api/household': {
      get: op({
        tag: 'משק הבית',
        summary: 'פרטי הבית. מנהלת רואה גם את קוד ההצטרפות',
        who: 'all',
        ok: { schema: obj({ id: uuid, name: str('משפחת כהן'), membersCount: int(4), inviteCode: str('KITCHEN1', { description: 'למנהלת בלבד' }) }) },
      }),
    },
    '/api/household/members': {
      get: op({ tag: 'משק הבית', summary: 'בני הבית וכמה כוכבים לכל אחד', who: 'manager', ok: { schema: arr({ allOf: [ref('User'), obj({ stars: int(3) })] }) } }),
    },
    '/api/household/members/{id}': {
      patch: op({
        tag: 'משק הבית',
        summary: 'שינוי תפקיד (מנהלת / בן משפחה)',
        description: 'בבית צריכה להישאר לפחות מנהלת אחת.',
        who: 'manager',
        params: idParam,
        body: obj({ role: str('MANAGER', { enum: ['MANAGER', 'MEMBER'] }) }, ['role']),
        ok: { schema: ref('User') },
        errors: [404, 409],
      }),
      delete: op({ tag: 'משק הבית', summary: 'הסרת בן בית (אי אפשר להסיר את עצמך)', who: 'manager', params: idParam, ok: { status: 204 }, errors: [404, 409] }),
    },
    '/api/household/invite-code': {
      post: op({ tag: 'משק הבית', summary: 'קוד הצטרפות חדש. הקוד הישן מפסיק לעבוד', who: 'manager', ok: { schema: obj({ inviteCode: str('Q7M2KX9P') }) } }),
    },

    // ----- מצרכים ומלאי -----
    '/api/ingredients': {
      get: op({
        tag: 'מצרכים ומלאי',
        summary: 'רשימת המצרכים של הבית (לטופס מתכון)',
        who: 'all',
        query: { category: { ...department, description: 'סינון לפי מחלקה' }, q: { type: 'string', description: 'חיפוש לפי שם' } },
        ok: { schema: arr(ref('Ingredient')) },
      }),
      post: op({
        tag: 'מצרכים ומלאי',
        summary: 'מצרך חדש',
        who: 'manager',
        body: obj({ name: str('חציל'), category: department, unit: str('יח׳'), kosherType: kosher, needsInspection: bool, inStock: bool }, ['name', 'category', 'unit']),
        ok: { status: 201, schema: ref('Ingredient') },
        errors: [409],
      }),
    },
    '/api/ingredients/{id}': {
      patch: op({
        tag: 'מצרכים ומלאי',
        summary: 'עריכת מצרך (שם, מחלקה, יחידה, סוג, ״דורש בדיקה מחרקים״)',
        who: 'manager',
        params: idParam,
        body: obj({ name: str(), category: department, unit: str(), kosherType: kosher, needsInspection: bool }),
        ok: { schema: ref('Ingredient') },
        errors: [404, 409],
      }),
    },
    '/api/pantry': {
      get: op({
        tag: 'מצרכים ומלאי',
        summary: '״מה יש בבית״: כל המצרכים לפי מחלקות, עם יש / אין',
        who: 'all',
        ok: {
          schema: obj({
            inStockCount: int(22),
            total: int(40),
            groups: arr(
              obj({
                category: department,
                label: str('חלב וביצים'),
                inStockCount: int(3),
                items: arr(obj({ ingredientId: uuid, name: str('ביצים'), unit: str(), kosherType: kosher, needsInspection: bool, inStock: bool, updatedAt: nullable(str()), updatedBy: nullable(obj({ id: uuid, name: str() })) })),
              }),
            ),
          }),
        },
      }),
    },
    '/api/pantry/{ingredientId}': {
      patch: op({
        tag: 'מצרכים ומלאי',
        summary: 'סימון יש / אין. ״נגמר״ מוסיף את המצרך לרשימת הקניות',
        description: 'בן משפחה יכול רק לסמן ״נגמר״ (inStock: false). סימון ״יש בבית״ על ידי בן משפחה → 403.',
        who: 'special',
        params: ['ingredientId'],
        body: obj({ inStock: bool }, ['inStock']),
        ok: { schema: obj({ ingredientId: uuid, name: str('חלב'), inStock: bool, updatedAt: str(), addedToShopping: bool }) },
        errors: [404],
      }),
    },

    // ----- מתכונים -----
    '/api/recipes': {
      get: op({
        tag: 'מתכונים',
        summary: 'רשימת מתכונים עם חיפוש, סינון, מיון וחלוקה לעמודים',
        description: 'בן משפחה רואה רק מתכונים פעילים. השדות match, missing, canMakeNow, votesThisWeek, isFavorite מחושבים בשרת בכל בקשה.',
        who: 'all',
        query: {
          q: { type: 'string', description: 'חיפוש לפי שם' },
          category: { ...category, description: 'קטגוריה' },
          kosherType: { ...kosher },
          difficulty: { ...difficulty, description: 'רמת קושי' },
          maxMinutes: { type: 'integer', description: 'זמן הכנה מקסימלי בדקות' },
          shabbatFriendly: { type: 'string', enum: ['true', 'false'], description: 'מתאים לשבת' },
          ready: { type: 'string', enum: ['true', 'false'], description: 'true = יש הכול בבית' },
          favorites: { type: 'string', enum: ['true', 'false'], description: 'true = רק המועדפים שלי' },
          status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'ALL'], description: 'למנהלת. ברירת מחדל ACTIVE' },
          sort: { type: 'string', enum: ['name', 'prepMinutes', 'match', 'votes', 'createdAt'], description: 'מיון. ברירת מחדל name' },
          order: { type: 'string', enum: ['asc', 'desc'], description: 'כיוון המיון' },
          page: { type: 'integer', description: 'עמוד (מ־1)' },
          pageSize: { type: 'integer', description: 'כמה בעמוד (עד 100, ברירת מחדל 20)' },
        },
        ok: { schema: paged(ref('RecipeCard')) },
      }),
      post: op({
        tag: 'מתכונים',
        summary: 'מתכון חדש עם מצרכים ושלבים',
        description: 'השרת בודק שסוג המתכון מתאים למצרכים: מצרך בשרי → בשרי, מצרך חלבי → חלבי, ובשר וחלב יחד → 400.',
        who: 'manager',
        body: ref('RecipeInput'),
        ok: { status: 201, schema: ref('RecipeDetail') },
        errors: [409],
      }),
    },
    '/api/recipes/wheel': {
      get: op({
        tag: 'מתכונים',
        summary: 'הגלגל: עד 10 מתכונים אקראיים',
        description: '״ממה שיש״ (ready): מתכונים שחסר להם לכל היותר מצרך אחד. אם יש פחות מ־2 כאלה, חוזרים כל המתכונים ו־usedFallback הוא true.',
        who: 'all',
        query: { mode: { type: 'string', enum: ['ready', 'all'], description: 'ברירת מחדל ready' } },
        ok: { schema: obj({ mode: str('ready'), usedFallback: bool, items: arr(ref('RecipeCard')) }) },
      }),
    },
    '/api/recipes/{id}': {
      get: op({
        tag: 'מתכונים',
        summary: 'מתכון מלא: מצרכים (✓ / ✗), שלבים וטיימרים, עם כמויות לפי מספר מנות',
        who: 'all',
        params: idParam,
        query: { servings: { type: 'integer', description: 'לכמה מנות לחשב את הכמויות (1-50)' } },
        ok: { schema: ref('RecipeDetail') },
        errors: [404],
      }),
      put: op({
        tag: 'מתכונים',
        summary: 'עריכת מתכון (המצרכים והשלבים מוחלפים ברשימה החדשה)',
        who: 'manager',
        params: idParam,
        body: ref('RecipeInput'),
        ok: { schema: ref('RecipeDetail') },
        errors: [404, 409],
      }),
    },
    '/api/recipes/{id}/status': {
      patch: op({
        tag: 'מתכונים',
        summary: 'העברה לארכיון או החזרה לפעיל',
        who: 'manager',
        params: idParam,
        body: obj({ status: str('ARCHIVED', { enum: ['ACTIVE', 'ARCHIVED'] }) }, ['status']),
        ok: { schema: ref('RecipeDetail') },
        errors: [404],
      }),
    },
    '/api/recipes/{id}/image': {
      get: op({
        tag: 'מתכונים',
        summary: 'תמונת המתכון (פתוח בלי token, כדי שתגית img תוכל להציג)',
        who: 'public',
        params: idParam,
        ok: { image: true },
        errors: [404],
      }),
      post: op({
        tag: 'מתכונים',
        summary: 'העלאת תמונה (JPG או PNG, עד 2MB). נשמרת בשרת, בלי קישור לאתר חיצוני',
        who: 'manager',
        params: idParam,
        upload: true,
        ok: { schema: obj({ imageUrl: str('/api/recipes/3f1c.../image?v=1729000000000') }) },
        errors: [404],
      }),
      delete: op({ tag: 'מתכונים', summary: 'מחיקת התמונה', who: 'manager', params: idParam, ok: { status: 204 }, errors: [404] }),
    },
    '/api/recipes/{id}/vote': {
      post: op({
        tag: 'מתכונים',
        summary: '״רוצה את זה השבוע״',
        who: 'all',
        params: idParam,
        ok: { status: 201, schema: obj({ votesThisWeek: int(3), votedByMe: bool }) },
        errors: [404, 409],
      }),
      delete: op({ tag: 'מתכונים', summary: 'ביטול ההצבעה שלי', who: 'all', params: idParam, ok: { schema: obj({ votesThisWeek: int(2), votedByMe: bool }) }, errors: [404] }),
    },
    '/api/recipes/{id}/favorite': {
      post: op({ tag: 'מתכונים', summary: 'סימון כמועדף', who: 'all', params: idParam, ok: { status: 204 }, errors: [404] }),
      delete: op({ tag: 'מתכונים', summary: 'הסרה מהמועדפים', who: 'all', params: idParam, ok: { status: 204 }, errors: [404] }),
    },

    // ----- תפריט -----
    '/api/menu': {
      get: op({
        tag: 'תפריט שבועי',
        summary: 'התפריט של שבוע: ימים ראשון עד שישי, וסעודות השבת, עם תאריך עברי ופרשה',
        description: 'בכל ארוחה mixed=true אם יש בה גם מנה בשרית וגם חלבית. בשבוע עם חג נוספת ארוחת YOM_TOV ביום החג.',
        who: 'all',
        query: { week: { ...date, description: 'כל תאריך בשבוע. ברירת מחדל: השבוע הנוכחי' } },
        ok: {
          schema: obj({
            weekStart: date,
            weekEnd: date,
            parasha: nullable(str('פרשת לך־לך')),
            candleLighting: arr(ref('TimeOfDay')),
            havdalah: arr(ref('TimeOfDay')),
            mixedMeals: int(0),
            days: arr({ allOf: [ref('DayInfo'), obj({ meals: arr(obj({ meal, label: str('ערב'), mixed: bool, entries: arr(ref('MenuEntry')) })) })] }),
          }),
        },
      }),
      post: op({
        tag: 'תפריט שבועי',
        summary: 'שיבוץ מתכון לארוחה',
        who: 'manager',
        body: obj({ date, meal, recipeId: uuid, servings: int(6) }, ['date', 'meal', 'recipeId']),
        ok: { status: 201, schema: ref('MenuEntryResult') },
        errors: [404, 409],
      }),
    },
    '/api/menu/{id}': {
      patch: op({
        tag: 'תפריט שבועי',
        summary: 'הזזה אחרי גרירה (תאריך, ארוחה, מיקום) או שינוי מספר מנות',
        who: 'manager',
        params: idParam,
        body: obj({ date, meal, order: int(0), servings: int(4) }),
        ok: { schema: ref('MenuEntryResult') },
        errors: [404],
      }),
      delete: op({ tag: 'תפריט שבועי', summary: 'הסרה מהתפריט', who: 'manager', params: idParam, ok: { status: 204 }, errors: [404] }),
    },

    // ----- רשימת קניות -----
    '/api/shopping': {
      get: op({
        tag: 'רשימת קניות',
        summary: 'רשימת הקניות לפי מחלקות: מהתפריט (פחות מה שיש בבית), ידני ובקשות שאושרו',
        description: 'ארוחות שכבר עברו לא נכנסות. requests: למנהלת כל הבקשות, לבן משפחה רק שלו.',
        who: 'all',
        query: { week: { ...date, description: 'כל תאריך בשבוע. ברירת מחדל: השבוע הנוכחי' } },
        ok: {
          schema: obj({
            weekStart: date,
            from: date,
            progress: obj({ bought: int(3), total: int(12), percent: int(25) }),
            groups: arr(obj({ category: department, label: str('חלב וביצים'), items: arr(ref('ShoppingItem')) })),
            requests: arr(ref('ShoppingItem')),
          }),
        },
      }),
      post: op({
        tag: 'רשימת קניות',
        summary: 'הוספת פריט. מנהלת: נכנס מיד. בן משפחה: בקשה שממתינה לאישור + התראה למנהלות',
        who: 'all',
        body: obj({ name: str('שוקו'), category: department, quantity: { type: 'number', example: 2 }, unit: str('יח׳'), ingredientId: uuid }, ['name', 'category']),
        bodyExample: { name: 'שוקו', category: 'DAIRY' },
        ok: { status: 201, schema: ref('ShoppingItem') },
        errors: [404],
      }),
    },
    '/api/shopping/requests': {
      get: op({ tag: 'רשימת קניות', summary: 'בקשות קניה. מנהלת: כולן. בן משפחה: רק שלו', who: 'all', ok: { schema: arr(ref('ShoppingItem')) } }),
    },
    '/api/shopping/bought': {
      patch: op({
        tag: 'רשימת קניות',
        summary: 'סימון ״קניתי״ או ביטול',
        description: 'פריט שנוסף (MANUAL / REQUEST) מזוהה לפי itemId. פריט מהתפריט (AUTO) מזוהה לפי ingredientId.',
        who: 'all',
        body: obj({ itemId: uuid, ingredientId: uuid, bought: bool, week: date }, ['bought']),
        bodyExample: { ingredientId: '3f1c2a8e-6b2d-4c1e-9a7b-2d4e5f6a7b8c', bought: true },
        ok: { schema: ref('ShoppingItem') },
        errors: [404, 409],
      }),
    },
    '/api/shopping/finish': {
      post: op({
        tag: 'רשימת קניות',
        summary: '״סיימתי לקנות״: כל מה שנקנה עובר ל״יש בבית״ ויוצא מהרשימה (טרנזקציה אחת)',
        who: 'all',
        body: obj({}),
        bodyExample: {},
        ok: { schema: obj({ movedToPantry: int(8), removedItems: int(9), message: str('8 מצרכים נכנסו למלאי') }) },
      }),
    },
    '/api/shopping/{id}/review': {
      patch: op({
        tag: 'רשימת קניות',
        summary: 'אישור או דחייה של בקשה + התראה למבקש',
        who: 'manager',
        params: idParam,
        body: obj({ action: str('approve', { enum: ['approve', 'decline'] }) }, ['action']),
        ok: { schema: ref('ShoppingItem') },
        errors: [404, 409],
      }),
    },
    '/api/shopping/{id}': {
      delete: op({ tag: 'רשימת קניות', summary: 'מחיקת פריט מהרשימה', who: 'manager', params: idParam, ok: { status: 204 }, errors: [404] }),
    },

    // ----- משימות -----
    '/api/tasks': {
      get: op({
        tag: 'משימות',
        summary: 'משימות. מנהלת: כולן. בן משפחה: רק שלו',
        who: 'all',
        query: {
          status: { type: 'string', enum: ['OPEN', 'DONE'] },
          assignedTo: { ...uuid, description: 'למנהלת: משימות של בן בית מסוים' },
          isErevShabbat: { type: 'string', enum: ['true', 'false'] },
          q: { type: 'string', description: 'חיפוש בכותרת' },
          sort: { type: 'string', enum: ['dueDate', 'createdAt', 'title'] },
          order: { type: 'string', enum: ['asc', 'desc'] },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
        },
        ok: { schema: paged(ref('Task')) },
      }),
      post: op({
        tag: 'משימות',
        summary: 'משימה חדשה + התראה לבן הבית',
        who: 'manager',
        body: obj({ title: str('לקלף תפוחי אדמה לקוגל'), assignedToId: uuid, dueDate: nullable(date), isErevShabbat: bool }, ['title', 'assignedToId']),
        ok: { status: 201, schema: ref('Task') },
      }),
    },
    '/api/tasks/stars': {
      get: op({ tag: 'משימות', summary: 'לוח כוכבי עזרה: כוכב על כל משימה שהושלמה', who: 'all', ok: { schema: arr(obj({ id: uuid, name: str('שירה'), color: str(), stars: int(4) })) } }),
    },
    '/api/tasks/erev-shabbat': {
      post: op({
        tag: 'משימות',
        summary: 'חלוקת המשימות הקבועות לערב שבת של השבוע',
        description: 'למי: לפי assignments, ואם לא נשלח, לפי ברירת המחדל של המשימה הקבועה. משימה שכבר חולקה השבוע לא נוצרת שוב.',
        who: 'manager',
        body: obj({ assignments: arr(obj({ templateId: uuid, assignedToId: uuid }, ['templateId', 'assignedToId'])) }),
        bodyExample: { assignments: [] },
        ok: { status: 201, schema: obj({ friday: date, created: arr(ref('Task')), skipped: arr(obj({ templateId: uuid, title: str(), reason: str('כבר חולקה השבוע') })) }) },
        errors: [404],
      }),
    },
    '/api/tasks/{id}': {
      patch: op({
        tag: 'משימות',
        summary: 'עריכת משימה',
        who: 'manager',
        params: idParam,
        body: obj({ title: str(), assignedToId: uuid, dueDate: nullable(date), status: str('DONE', { enum: ['OPEN', 'DONE'] }) }),
        ok: { schema: ref('Task') },
        errors: [404],
      }),
      delete: op({ tag: 'משימות', summary: 'מחיקת משימה', who: 'manager', params: idParam, ok: { status: 204 }, errors: [404] }),
    },
    '/api/tasks/{id}/toggle': {
      patch: op({
        tag: 'משימות',
        summary: '״סיימתי״ / ביטול. בן משפחה רק על משימה שלו',
        description: 'כשבן משפחה מסיים משימה, המנהלות מקבלות התראה.',
        who: 'special',
        params: idParam,
        ok: { schema: ref('Task') },
        errors: [404],
      }),
    },
    '/api/task-templates': {
      get: op({ tag: 'משימות', summary: 'המשימות הקבועות לערב שבת', who: 'manager', ok: { schema: arr(ref('TaskTemplate')) } }),
      post: op({
        tag: 'משימות',
        summary: 'משימה קבועה חדשה (0 = שישי, 1 = חמישי, 2 = רביעי)',
        who: 'manager',
        body: obj({ title: str('להכין פלטה'), daysBeforeShabbat: int(0), defaultAssigneeId: nullable(uuid) }, ['title']),
        ok: { status: 201, schema: ref('TaskTemplate') },
      }),
    },
    '/api/task-templates/{id}': {
      delete: op({ tag: 'משימות', summary: 'מחיקת משימה קבועה', who: 'manager', params: idParam, ok: { status: 204 }, errors: [404] }),
    },

    // ----- התראות -----
    '/api/notifications': {
      get: op({
        tag: 'התראות',
        summary: 'ההתראות שלי (50 האחרונות)',
        who: 'all',
        query: { unreadOnly: { type: 'string', enum: ['true', 'false'] } },
        ok: { schema: obj({ unreadCount: int(2), items: arr(ref('Notification')) }) },
      }),
    },
    '/api/notifications/read': {
      patch: op({
        tag: 'התראות',
        summary: 'סימון כנקרא: כולן, או רק ids שנשלחו',
        who: 'all',
        body: obj({ ids: arr(uuid) }),
        bodyExample: {},
        ok: { status: 204 },
      }),
    },
  };

  return {
    openapi: '3.0.3',
    info: {
      title: 'מה מבשלים היום? API',
      version: '1.0.0',
      description:
        'שרת לאתר משפחתי לניהול המטבח: מלאי, מתכונים, תפריט שבועי וסעודות שבת, רשימת קניות ומשימות.\n\n' +
        '**איך מתחברים מכאן:** פותחים את `POST /api/auth/login`, לוחצים Try it out, שולחים מייל וסיסמה מנתוני הדוגמה ' +
        '(manager@example.com / Manager123), מעתיקים את ה־token מהתשובה, לוחצים על הכפתור Authorize למעלה ומדביקים אותו.\n\n' +
        'כל השגיאות חוזרות במבנה `{ "error": { "code", "message", "details" } }`.\n\n' +
        '**שבת וחג:** מהדלקת נרות ועד הבדלה (זמני ירושלים) כל הנתיבים מחזירים 503 עם שעת צאת השבת, חוץ מ־`/api/health`.',
    },
    servers: [{ url: '/', description: 'השרת הנוכחי' }],
    security: [{ bearerAuth: [] }],
    tags: ['כללי', 'התחברות', 'דף הבית', 'משק הבית', 'מצרכים ומלאי', 'מתכונים', 'תפריט שבועי', 'רשימת קניות', 'משימות', 'התראות'].map((name) => ({ name })),
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas,
    },
    paths,
  };
}
