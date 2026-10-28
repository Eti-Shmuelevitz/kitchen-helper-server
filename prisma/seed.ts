   import 'dotenv/config';
// נתוני הדגמה: שני משקי בית, מנהלת ובני משפחה, מצרכים, מלאי, מתכונים, תפריט לשבוע הנוכחי,
// בקשות קניה, משימות והתראות. כל הנתונים מומצאים.
//
// בסביבת Production לא נוצרים חשבונות עם סיסמאות ידועות.
// אפשר ליצור בית הדגמה גם שם רק אם מגדירים SEED_DEMO_PASSWORD (סיסמה משלך).
import { PrismaClient, type Difficulty, type KosherType, type Meal, type RecipeCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_INGREDIENTS } from '../src/services/defaults';

const prisma = new PrismaClient();

const TZ = process.env.TIMEZONE ?? 'Asia/Jerusalem';
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
function addDays(iso: string, n: number) {
  const x = d(iso);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const weekStart = (iso: string) => addDays(iso, -d(iso).getUTCDay());

interface RecipeSeed {
  name: string;
  description: string;
  category: RecipeCategory;
  kosherType: KosherType;
  shabbatFriendly?: boolean;
  difficulty: Difficulty;
  prepMinutes: number;
  servings: number;
  color: string;
  archived?: boolean;
  ingredients: [string, number, string?, boolean?][]; // שם, כמות, יחידה (לא חובה), אופציונלי
  steps: [string, number?][];
}

const RECIPES: RecipeSeed[] = [
  {
    name: 'שקשוקה',
    description: 'שקשוקה ביתית בסיר אחד',
    category: 'BREAKFAST',
    kosherType: 'PAREVE',
    difficulty: 'EASY',
    prepMinutes: 25,
    servings: 4,
    color: '#c2410c',
    ingredients: [['עגבניות', 5], ['בצל', 1], ['פלפל אדום', 1], ['ביצים', 6], ['שום', 2], ['פפריקה', 0], ['מלח', 0]],
    steps: [['מטגנים בצל ופלפל עד שמזהיבים'], ['מוסיפים עגבניות ותבלינים ומבשלים', 10], ['שוברים פנימה את הביצים, מכסים ומבשלים', 6]],
  },
  {
    name: 'חמין',
    description: 'חמין לשבת שמתבשל כל הלילה על הפלטה',
    category: 'SHABBAT_HOLIDAY',
    kosherType: 'MEAT',
    shabbatFriendly: true,
    difficulty: 'HARD',
    prepMinutes: 720,
    servings: 8,
    color: '#7c2d12',
    ingredients: [['בשר בקר', 800], ['תפוחי אדמה', 6], ['שעועית', 1], ['גריסים', 0.5], ['ביצים', 6], ['בצל', 2], ['פפריקה', 1], ['מלח', 0]],
    steps: [['משרים את השעועית מהלילה הקודם'], ['מניחים בסיר את כל המצרכים ומכסים במים'], ['מבשלים שעה, ומעבירים לפלטה לפני כניסת שבת', 60]],
  },
  {
    name: 'קוגל תפוחי אדמה',
    description: 'קוגל זהוב ופריך מלמעלה',
    category: 'SIDE',
    kosherType: 'PAREVE',
    shabbatFriendly: true,
    difficulty: 'MEDIUM',
    prepMinutes: 90,
    servings: 8,
    color: '#a16207',
    ingredients: [['תפוחי אדמה', 8], ['ביצים', 4], ['בצל', 2], ['שמן', 4], ['מלח', 1], ['פלפל שחור', 0]],
    steps: [['מגררים תפוחי אדמה ובצל'], ['מערבבים עם הביצים, השמן והתבלינים'], ['אופים ב־200 מעלות', 75]],
  },
  {
    name: 'עוף בתנור',
    description: 'עוף צלוי עם תפוחי אדמה',
    category: 'MAIN',
    kosherType: 'MEAT',
    shabbatFriendly: true,
    difficulty: 'EASY',
    prepMinutes: 100,
    servings: 6,
    color: '#b45309',
    ingredients: [['עוף שלם', 1], ['תפוחי אדמה', 4], ['בצל', 2], ['שום', 4], ['פפריקה', 1], ['שמן', 2]],
    steps: [['מתבלים את העוף'], ['מסדרים בתבנית עם תפוחי האדמה והבצל'], ['אופים מכוסה ואחר כך פתוח', 90]],
  },
  {
    name: 'סלט ירקות',
    description: 'סלט קצוץ דק',
    category: 'SALAD',
    kosherType: 'PAREVE',
    shabbatFriendly: true,
    difficulty: 'EASY',
    prepMinutes: 15,
    servings: 4,
    color: '#15803d',
    ingredients: [['עגבניות', 3], ['מלפפונים', 3], ['בצל', 1], ['לימון', 1], ['שמן', 2], ['מלח', 0], ['פטרוזיליה', 1, undefined, true]],
    steps: [['קוצצים את הירקות דק'], ['מתבלים בלימון, שמן ומלח רגע לפני ההגשה']],
  },
  {
    name: 'מרק עוף',
    description: 'מרק עוף צלול עם ירקות',
    category: 'SOUP',
    kosherType: 'MEAT',
    shabbatFriendly: true,
    difficulty: 'MEDIUM',
    prepMinutes: 120,
    servings: 8,
    color: '#ca8a04',
    ingredients: [['עוף שלם', 1], ['גזר', 3], ['קישואים', 2], ['בצל', 1], ['שמיר', 1], ['מלח', 1]],
    steps: [['מניחים את העוף בסיר גדול עם מים ומביאים לרתיחה'], ['מוסיפים את הירקות ומבשלים על אש קטנה', 100]],
  },
  {
    name: 'פשטידת גבינות',
    description: 'פשטידה חלבית לארוחת ערב',
    category: 'MAIN',
    kosherType: 'DAIRY',
    difficulty: 'MEDIUM',
    prepMinutes: 50,
    servings: 6,
    color: '#eab308',
    ingredients: [['ביצים', 4], ['גבינה לבנה', 250], ['גבינה צהובה', 200], ['שמנת מתוקה', 250], ['קמח', 0.5], ['מלח', 0]],
    steps: [['מערבבים את כל המצרכים בקערה'], ['אופים ב־180 מעלות', 40]],
  },
  {
    name: 'עוגת שוקולד',
    description: 'עוגה פרווה בחושה אחת',
    category: 'DESSERT',
    kosherType: 'PAREVE',
    shabbatFriendly: true,
    difficulty: 'EASY',
    prepMinutes: 45,
    servings: 12,
    color: '#78350f',
    ingredients: [['קמח', 2], ['סוכר', 1.5], ['ביצים', 4], ['שמן', 0.75, 'כוס'], ['שוקולד מריר', 100], ['אבקת אפייה', 2]],
    steps: [['ממיסים את השוקולד עם השמן'], ['מוסיפים את שאר המצרכים ומערבבים'], ['אופים ב־180 מעלות', 35]],
  },
  {
    name: 'חלות לשבת',
    description: 'חלות מתוקות ורכות',
    category: 'BAKED',
    kosherType: 'PAREVE',
    shabbatFriendly: true,
    difficulty: 'HARD',
    prepMinutes: 180,
    servings: 4,
    color: '#d97706',
    ingredients: [['קמח', 8], ['שמרים', 50], ['סוכר', 0.75], ['שמן', 0.5, 'כוס'], ['ביצים', 1], ['מלח', 1]],
    steps: [['לשים בצק רך ומניחים להתפחה', 60], ['מפרישים חלה בברכה, קולעים ומניחים בתבניות'], ['אופים ב־180 מעלות', 30]],
  },
  {
    name: 'אורז לבן',
    description: 'אורז אוורירי',
    category: 'SIDE',
    kosherType: 'PAREVE',
    difficulty: 'EASY',
    prepMinutes: 25,
    servings: 4,
    color: '#a3a3a3',
    ingredients: [['אורז', 2], ['שמן', 1], ['מלח', 1]],
    steps: [['בודקים את האורז ושוטפים'], ['מבשלים על אש קטנה עם מכסה', 18]],
  },
  {
    name: 'פתיתים',
    description: 'פתיתים ברוטב עגבניות',
    category: 'SIDE',
    kosherType: 'PAREVE',
    difficulty: 'EASY',
    prepMinutes: 20,
    servings: 4,
    color: '#f59e0b',
    ingredients: [['פתיתים', 2], ['בצל', 1], ['רסק עגבניות', 1], ['שמן', 1]],
    steps: [['מטגנים בצל וקולים את הפתיתים'], ['מוסיפים רסק ומים ומבשלים', 10]],
  },
  {
    name: 'שניצל עוף',
    description: 'שניצל פריך שהילדים אוהבים',
    category: 'MAIN',
    kosherType: 'MEAT',
    difficulty: 'MEDIUM',
    prepMinutes: 40,
    servings: 4,
    color: '#ea580c',
    ingredients: [['חזה עוף', 600], ['ביצים', 2], ['קמח', 0.5], ['שמן', 6]],
    steps: [['מצפים את החזה בקמח ובביצה'], ['מטגנים משני הצדדים', 8]],
  },
  {
    name: 'מוקפץ ירקות',
    description: 'מתכון ישן שהועבר לארכיון',
    category: 'MAIN',
    kosherType: 'PAREVE',
    difficulty: 'EASY',
    prepMinutes: 20,
    servings: 4,
    color: '#65a30d',
    archived: true,
    ingredients: [['גזר', 2], ['קישואים', 2], ['ברוקולי קפוא', 300], ['שמן', 2]],
    steps: [['מקפיצים את הירקות במחבת חמה', 8]],
  },
];

// מה אין בבית כרגע (כל השאר: יש)
const OUT_OF_STOCK = ['פלפל אדום', 'בשר בקר', 'שעועית', 'גריסים', 'גבינה צהובה', 'שמנת מתוקה', 'שוקולד מריר', 'שמרים', 'אפונה קפואה', 'חלב', 'חסה', 'סלמון', 'ברוקולי קפוא'];

async function createHousehold(name: string, inviteCode: string) {
  const household = await prisma.household.create({ data: { name, inviteCode } });
  for (const [iname, category, unit, kosherType = 'PAREVE', needsInspection = false] of DEFAULT_INGREDIENTS) {
    await prisma.ingredient.create({
      data: {
        householdId: household.id,
        name: iname,
        category,
        unit,
        kosherType,
        needsInspection,
        pantryItem: { create: { householdId: household.id, inStock: !OUT_OF_STOCK.includes(iname) } },
      },
    });
  }
  return household;
}

async function createRecipe(householdId: string, createdById: string, r: RecipeSeed) {
  const ingredients = await prisma.ingredient.findMany({ where: { householdId } });
  const byName = new Map(ingredients.map((i) => [i.name, i]));
  return prisma.recipe.create({
    data: {
      householdId,
      createdById,
      name: r.name,
      description: r.description,
      category: r.category,
      kosherType: r.kosherType,
      shabbatFriendly: r.shabbatFriendly ?? false,
      difficulty: r.difficulty,
      prepMinutes: r.prepMinutes,
      servings: r.servings,
      color: r.color,
      status: r.archived ? 'ARCHIVED' : 'ACTIVE',
      ingredients: {
        create: r.ingredients.map(([n, quantity, unit, isOptional]) => {
          const ing = byName.get(n);
          if (!ing) throw new Error(`מצרך חסר בנתוני ההדגמה: ${n}`);
          return { ingredientId: ing.id, quantity, unit: unit ?? ing.unit, isOptional: isOptional ?? false };
        }),
      },
      steps: { create: r.steps.map(([text, timerMinutes], i) => ({ order: i + 1, text, timerMinutes: timerMinutes ?? null })) },
    },
  });
}

async function seedDemo(passwords: { manager: string; member: string; other: string }) {
  const [hManager, hMember, hOther] = await Promise.all([bcrypt.hash(passwords.manager, 10), bcrypt.hash(passwords.member, 10), bcrypt.hash(passwords.other, 10)]);

  // ----- בית ראשון: משפחת כהן -----
  const cohen = await createHousehold('משפחת כהן', 'KITCHEN1');
  const rachel = await prisma.user.create({ data: { householdId: cohen.id, name: 'רחל כהן', email: 'manager@example.com', passwordHash: hManager, role: 'MANAGER', color: '#2c5c60' } });
  const yossi = await prisma.user.create({ data: { householdId: cohen.id, name: 'יוסי', email: 'member@example.com', passwordHash: hMember, role: 'MEMBER', color: '#2f6a9e' } });
  const shira = await prisma.user.create({ data: { householdId: cohen.id, name: 'שירה', email: 'member2@example.com', passwordHash: hMember, role: 'MEMBER', color: '#7a5ba8' } });

  const recipes = new Map<string, string>();
  for (const r of RECIPES) recipes.set(r.name, (await createRecipe(cohen.id, rachel.id, r)).id);
  const rid = (n: string) => recipes.get(n)!;

  // תפריט לשבוע הנוכחי
  const ws = weekStart(todayIso());
  const plan: [number, Meal, string, number?][] = [
    [0, 'DINNER', 'שניצל עוף'],
    [0, 'DINNER', 'אורז לבן'],
    [1, 'DINNER', 'פשטידת גבינות'],
    [1, 'DINNER', 'סלט ירקות'],
    [2, 'LUNCH', 'פתיתים'],
    [3, 'DINNER', 'עוף בתנור'],
    [4, 'BREAKFAST', 'שקשוקה'],
    [5, 'LUNCH', 'פתיתים'],
    [6, 'SHABBAT_NIGHT', 'חלות לשבת'],
    [6, 'SHABBAT_NIGHT', 'מרק עוף'],
    [6, 'SHABBAT_NIGHT', 'עוף בתנור'],
    [6, 'SHABBAT_DAY', 'חמין', 10],
    [6, 'SHABBAT_DAY', 'קוגל תפוחי אדמה'],
    [6, 'SEUDA_SHLISHIT', 'סלט ירקות'],
    [6, 'SEUDA_SHLISHIT', 'עוגת שוקולד'],
  ];
  const orderCounter = new Map<string, number>();
  for (const [day, meal, name, servings] of plan) {
    const date = addDays(ws, day);
    const key = `${date}|${meal}`;
    const order = orderCounter.get(key) ?? 0;
    orderCounter.set(key, order + 1);
    const recipe = RECIPES.find((r) => r.name === name)!;
    await prisma.menuEntry.create({ data: { householdId: cohen.id, date: d(date), meal, recipeId: rid(name), servings: servings ?? recipe.servings, order, addedById: rachel.id } });
  }

  // הצבעות ומועדפים
  for (const [user, name] of [
    [yossi, 'שניצל עוף'],
    [yossi, 'חמין'],
    [shira, 'שניצל עוף'],
    [shira, 'עוגת שוקולד'],
  ] as const) {
    await prisma.vote.create({ data: { recipeId: rid(name), userId: user.id, weekStart: d(ws) } });
  }
  await prisma.favorite.create({ data: { recipeId: rid('עוגת שוקולד'), userId: yossi.id } });
  await prisma.favorite.create({ data: { recipeId: rid('שקשוקה'), userId: rachel.id } });

  // רשימת קניות ובקשות
  await prisma.shoppingItem.createMany({
    data: [
      { householdId: cohen.id, source: 'REQUEST', status: 'PENDING', name: 'שוקו', category: 'DAIRY', requestedById: yossi.id },
      { householdId: cohen.id, source: 'REQUEST', status: 'PENDING', name: 'במבה', category: 'PANTRY', requestedById: shira.id },
      { householdId: cohen.id, source: 'REQUEST', status: 'DECLINED', name: 'סוכריות', category: 'PANTRY', requestedById: yossi.id, reviewedById: rachel.id, reviewedAt: new Date() },
      { householdId: cohen.id, source: 'MANUAL', status: 'OPEN', name: 'נייר אפייה', category: 'FROZEN', requestedById: rachel.id },
    ],
  });

  // משימות
  const today = todayIso();
  await prisma.task.createMany({
    data: [
      { householdId: cohen.id, title: 'לקלף תפוחי אדמה לקוגל', assignedToId: shira.id, createdById: rachel.id, dueDate: d(addDays(ws, 5)), isErevShabbat: true },
      { householdId: cohen.id, title: 'לסדר את המקרר', assignedToId: yossi.id, createdById: rachel.id, dueDate: d(addDays(today, 1)) },
      { householdId: cohen.id, title: 'לערוך את השולחן', assignedToId: yossi.id, createdById: rachel.id, status: 'DONE', completedAt: new Date() },
      { householdId: cohen.id, title: 'לשטוף כלים', assignedToId: shira.id, createdById: rachel.id, status: 'DONE', completedAt: new Date() },
      { householdId: cohen.id, title: 'לקפל כביסה', assignedToId: shira.id, createdById: rachel.id, status: 'DONE', completedAt: new Date() },
    ],
  });
  await prisma.taskTemplate.createMany({
    data: [
      { householdId: cohen.id, title: 'לערוך שולחן לשבת', daysBeforeShabbat: 0, defaultAssigneeId: yossi.id },
      { householdId: cohen.id, title: 'להכין פלטה ומיחם', daysBeforeShabbat: 0, defaultAssigneeId: rachel.id },
      { householdId: cohen.id, title: 'לנקות את המטבח', daysBeforeShabbat: 1, defaultAssigneeId: shira.id },
      { householdId: cohen.id, title: 'לבדוק ירקות עלים מחרקים', daysBeforeShabbat: 0 },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: rachel.id, type: 'SHOPPING_REQUEST', text: 'יוסי ביקש/ה: שוקו', link: '/shopping' },
      { userId: rachel.id, type: 'SHOPPING_REQUEST', text: 'שירה ביקש/ה: במבה', link: '/shopping' },
      { userId: yossi.id, type: 'TASK_ASSIGNED', text: 'משימה חדשה: לסדר את המקרר', link: '/tasks' },
      { userId: yossi.id, type: 'REQUEST_DECLINED', text: 'הבקשה שלך לא אושרה הפעם: סוכריות', link: '/shopping', isRead: true },
    ],
  });

  // ----- בית שני: משפחת לוי (לבדיקה שכל בית רואה רק את שלו) -----
  const levi = await createHousehold('משפחת לוי', 'LEVI2026');
  const leah = await prisma.user.create({ data: { householdId: levi.id, name: 'לאה לוי', email: 'other@example.com', passwordHash: hOther, role: 'MANAGER', color: '#a33a3a' } });
  await createRecipe(levi.id, leah.id, { ...RECIPES[0]!, name: 'שקשוקה של לוי' });
}

async function main() {
  const existing = await prisma.household.count();
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.log('במסד כבר יש נתונים, ולכן נתוני ההדגמה לא נוספו. כדי להתחיל מחדש: npm run db:reset');
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) {
      // eslint-disable-next-line no-console
      console.log('Production: לא נוצרו חשבונות הדגמה. (אפשר להגדיר SEED_DEMO_PASSWORD כדי ליצור בית הדגמה עם סיסמה משלך)');
      return;
    }
    await seedDemo({ manager: pw, member: pw, other: pw });
  } else {
    await seedDemo({ manager: 'Manager123', member: 'Member123', other: 'Other1234' });
  }
  // eslint-disable-next-line no-console
  console.log('נתוני ההדגמה נוצרו: משפחת כהן (KITCHEN1) ומשפחת לוי (LEVI2026)');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
