# מה מבשלים היום?: שרת (Backend)

שרת לאתר משפחתי לניהול המטבח בבית שומר תורה ומצוות: מלאי, מתכונים, תפריט שבועי וסעודות שבת, רשימת קניות, בקשות, משימות והתראות.

**אם זו הפעם הראשונה שלך, התחילי בקובץ `START-HERE.md`.**
לכתיבת צד ה־React: `FRONTEND-API-GUIDE.md`.

## טכנולוגיות

| מה | גרסה |
| --- | --- |
| Node.js | 20 ומעלה (מומלץ 22 LTS) |
| Express | 4.22 |
| TypeScript | 5.6, מצב strict |
| PostgreSQL + Prisma ORM | Prisma 5.22 |
| Zod (בדיקת קלט) | 3.23 |
| JWT + bcrypt (bcryptjs) | התחברות והצפנת סיסמאות |
| Swagger UI (OpenAPI 3) | בכתובת `/api-docs` |
| @hebcal/core | תאריך עברי, פרשת השבוע, חגים וזמני שבת |
| multer | העלאת תמונות מתכונים |
| Vitest + Supertest | בדיקות |

## הרצה במחשב (Visual Studio Code)

צריך Node.js ומסד PostgreSQL. הכי פשוט: מסד חינמי ב־Neon (הסבר ב־`START-HERE.md`, חלק א).

בטרמינל של VS Code (Terminal ← New Terminal):

```bash
npm install
copy .env.example .env        # ב־Mac / Linux: cp .env.example .env
# פותחים את .env וממלאים DATABASE_URL ו־JWT_SECRET
npx prisma migrate deploy     # יוצר את הטבלאות
npm run db:seed               # נתוני הדגמה
npm run dev                   # השרת עולה בכתובת http://localhost:4000
```

- בדיקת בריאות: http://localhost:4000/api/health
- Swagger: http://localhost:4000/api-docs
- בקשות לדוגמה: הקובץ `requests.http` (עם התוסף REST Client)

## משתמשים לדוגמה (רק בסביבת פיתוח)

| תפקיד | מייל | סיסמה |
| --- | --- | --- |
| מנהלת הבית (משפחת כהן) | manager@example.com | Manager123 |
| בן משפחה: יוסי | member@example.com | Member123 |
| בת משפחה: שירה | member2@example.com | Member123 |
| מנהלת של בית אחר (משפחת לוי) | other@example.com | Other1234 |

**הרשמה:** כל מי שנרשמת (`POST /api/auth/register`) בוחרת תפקיד ומצטרפת לבית המשותף (משפחת כהן בנתוני ההדגמה). כדי להירשם כמנהלת הבית צריך את קוד המנהלת: `1357`, או מה שהוגדר ב־`MANAGER_CODE`.
ב־Production לא נוצרות סיסמאות קבועות. אם המסד ריק, ההרשמה הראשונה יוצרת את הבית המשותף.

## פקודות

| פקודה | מה היא עושה |
| --- | --- |
| `npm run dev` | הרצה בפיתוח עם טעינה מחדש |
| `npm run build` | Prisma generate + קומפילציה לתיקיית `dist` |
| `npm start` | הרצת הגרסה המקומפלת |
| `npm run typecheck` | בדיקת TypeScript |
| `npm test` | בדיקות אוטומטיות (צריך `TEST_DATABASE_URL`, ראו למטה) |
| `npm run db:deploy` | הרצת מיגרציות |
| `npm run db:seed` | נתוני הדגמה (רק אם המסד ריק) |
| `npm run db:reset` | מחיקת המסד ויצירה מחדש עם נתוני הדגמה |
| `npm run openapi` | יצירת `docs/openapi.json` מחדש |

## בדיקות

הבדיקות רצות מול PostgreSQL אמיתי, במסד נפרד. **הן מוחקות את המסד הזה בכל הרצה**, אז אל תשתמשי במסד האמיתי.
אפשר לפתוח ב־Neon מסד שני בשם `kitchen_test` (Databases ← New Database) ולהשתמש בכתובת שלו.

PowerShell:
```powershell
$env:TEST_DATABASE_URL="כתובת מסד הבדיקות"; npm test
```

מה נבדק (50 בדיקות): כניסה תקינה ושגויה, נעילה אחרי 5 ניסיונות, token חסר, לא תקין ושפג תוקפו, הרשאות מנהלת ובן משפחה, CRUD של מתכונים, משימות, תפריט ורשימת קניות, ולידציה (כולל בשר וחלב באותו מתכון), חיפוש, סינון, מיון ועמודים, שמשפחה אחת לא רואה נתונים של משפחה אחרת, שבן משפחה רואה רק את המשימות והבקשות שלו, תמונות, תאריך עברי ופרשה, סגירת האתר בשבת, ושכל נתיב בשרת מתועד ב־Swagger.

## מה נבדק בפועל לפני המסירה

ראו `docs/VERIFICATION.md`.

## מבנה התיקיות

```
src/
  app.ts, server.ts       יצירת השרת והפעלתו
  config/env.ts           משתני סביבה (נבדקים בעלייה)
  db/prisma.ts            חיבור למסד הנתונים
  auth/                   JWT, הצפנת סיסמאות, טבלת הרשאות (can)
  middleware/             התחברות, תפקידים, סגירה בשבת, בדיקת קלט, הגבלת קצב, טיפול בשגיאות
  modules/<נושא>/         לכל נושא: routes, controller, service, schemas
     auth, household, ingredients, pantry, recipes, menu, calendar, shopping, tasks, notifications, today
  services/               התראות, קוד הצטרפות, מצרכים בסיסיים לבית חדש
  shared/                 סכמות ופונקציות משותפות
  utils/                  חישובים (התאמה למלאי, רשימת קניות, גלגל, כוכבים), תאריכים, לוח עברי
  docs/openapi.ts         תיעוד Swagger
prisma/
  schema.prisma           מבנה מסד הנתונים
  migrations/             מיגרציות
  seed.ts                 נתוני הדגמה
tests/                    בדיקות
docs/                     openapi.json, תיעוד מסד הנתונים, דוח בדיקה
.vscode/                  הגדרות ל־VS Code (תוספים מומלצים, הרצה עם Debug)
requests.http             בקשות לדוגמה
```

## שבת וחג

מהדלקת נרות ועד הבדלה (זמני ירושלים, לפי הספרייה @hebcal/core) כל נתיבי ה־API מחזירים `503` עם הקוד `SHABBAT` ושעת צאת השבת. רק `/api/health` ממשיך לעבוד, כדי ששירות הענן לא יחשוב שהשרת נפל.
התראות נוצרות רק בעקבות פעולה של משתמש, ולכן בשבת לא נוצרות התראות.

## תמונות מתכונים

התמונות נשמרות בתוך מסד הנתונים (טבלה `RecipeImage`) ולא בתיקייה בשרת. בשירות ענן חינמי הקבצים בשרת נמחקים בכל הפעלה מחדש, ובמסד הם נשמרים. כך גם אין צורך בתמונות מאתרים חיצוניים, וזה מתאים לאינטרנט מסונן.
