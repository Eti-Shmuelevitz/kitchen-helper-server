# מדריך לכתיבת צד ה־React מול השרת

המסמך הזה מסביר איך האתר בריאקט מדבר עם השרת. את קוד הריאקט כותבים בעצמך. כאן יש רק מה שולחים ומה חוזר.
את כל הנתיבים אפשר לנסות ב־Swagger (`/api-docs`) לפני שכותבים קוד.

## 1. כתובת השרת (Base URL)

| איפה | כתובת |
| --- | --- |
| במחשב | `http://localhost:4000/api` |
| בענן | `https://<השם שלך>.onrender.com/api` |

מומלץ לשמור את הכתובת במשתנה סביבה של Vite: בקובץ `.env` של הריאקט `VITE_API_URL=http://localhost:4000/api`, ולקרוא אותו עם `import.meta.env.VITE_API_URL`.
בשרת צריך לשים את כתובת הריאקט ב־`CORS_ORIGINS` (במחשב: `http://localhost:5173`).

## 2. התחברות ו־token

1. שולחים `POST /auth/login` עם `{ "email", "password" }`.
2. חוזר `{ token, user }`. שומרים את ה־token ב־LocalStorage (זה הדבר היחיד ששומרים שם), ואת `user` ב־Context.
3. בכל בקשה אחרת שולחים כותרת:
   ```
   Authorization: Bearer <token>
   ```
4. ברענון הדף: אם יש token ב־LocalStorage, קוראים ל־`GET /auth/me` כדי לקבל את המשתמש מחדש. אם חזר 401, מוחקים את ה־token ושולחים למסך הכניסה.
5. **התפקיד** נמצא ב־`user.role`: `MANAGER` (מנהלת הבית) או `MEMBER` (בן משפחה). לפיו מסתירים כפתורים. השרת בודק את ההרשאות בכל מקרה.

כדאי שכל הקריאות לשרת ייצאו ממקום אחד (למשל `apiClient`) שמוסיף את ה־token וממיר שגיאות להודעה.

## 3. תשובות שגיאה

כל שגיאה חוזרת באותו מבנה:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "יש שדות חסרים או לא תקינים",
  "details": [ { "field": "name", "message": "שם של 2 תווים לפחות" } ] } }
```

| קוד HTTP | code | מתי | מה עושים בריאקט |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | שדה חסר או לא תקין | מציגים את `details` ליד השדות בטופס |
| 401 | `UNAUTHORIZED` | אין token, או שהוא פג | מחזירים למסך הכניסה |
| 403 | `FORBIDDEN` | אין הרשאה | מציגים את `message` |
| 404 | `NOT_FOUND` | לא קיים, או שייך לבית אחר | עמוד ״לא נמצא״ |
| 409 | `CONFLICT` | כפילות (מייל, שם מתכון, הצבעה), או בקשה שכבר טופלה | מציגים את `message` |
| 429 | `TOO_MANY_REQUESTS` | יותר מדי בקשות או ניסיונות כניסה | ״נסי שוב מאוחר יותר״ |
| 503 | `SHABBAT` | שבת או חג | עמוד ״שבת שלום! האתר סגור עד צאת השבת״, עם `details.reopensAtLocal` (למשל `"18:34"`) |

## 4. הרשאות

| פעולה | מנהלת | בן משפחה |
| --- | --- | --- |
| צפייה במתכונים, תפריט, מלאי ורשימת קניות | ✓ | ✓ |
| הוספה ועריכה של מתכון, ארכיון, תמונה | ✓ | ✗ |
| סימון ״יש בבית״ | ✓ | ✗ |
| סימון ״נגמר״ | ✓ | ✓ (המצרך נכנס לרשימת הקניות) |
| שינוי התפריט | ✓ | ✗ |
| הצבעה ״רוצה את זה השבוע״ ומועדפים | ✓ | ✓ |
| הוספה לרשימת הקניות | ✓ (נכנס מיד) | נשלח כבקשה שממתינה לאישור |
| אישור או דחייה של בקשה | ✓ | ✗ |
| צפייה בבקשות | כולן | רק שלו |
| ״קניתי״ ו״סיימתי לקנות״ | ✓ | ✓ |
| יצירה, עריכה ומחיקה של משימה, משימות קבועות | ✓ | ✗ |
| צפייה במשימות | כולן | רק שלו |
| ״סיימתי״ על משימה | כל משימה | רק שלו |
| בני הבית וקוד הצטרפות | ✓ | ✗ |

## 5. מבני הנתונים (TypeScript)

```ts
type Role = 'MANAGER' | 'MEMBER';
type Department = 'PRODUCE' | 'DAIRY' | 'MEAT' | 'PANTRY' | 'SPICES' | 'FROZEN';
type KosherType = 'MEAT' | 'DAIRY' | 'PAREVE';
type RecipeCategory = 'MAIN' | 'SIDE' | 'SALAD' | 'SOUP' | 'DESSERT' | 'BAKED' | 'BREAKFAST' | 'SHABBAT_HOLIDAY';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type Meal = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SHABBAT_NIGHT' | 'SHABBAT_DAY' | 'SEUDA_SHLISHIT' | 'YOM_TOV';

interface User { id: string; name: string; email: string; role: Role; color: string; householdId: string; createdAt: string }

interface RecipeCard {
  id: string; name: string; description: string | null;
  category: RecipeCategory; categoryLabel: string;          // ״ארוחת בוקר״
  kosherType: KosherType; kosherLabel: string;              // ״פרווה״
  shabbatFriendly: boolean; difficulty: Difficulty; difficultyLabel: string;
  prepMinutes: number; servings: number; color: string | null;
  status: 'ACTIVE' | 'ARCHIVED'; imageUrl: string | null;   // ״/api/recipes/<id>/image?v=..״
  match: { have: number; total: number; percent: number };  // לפס ההתאמה למלאי
  missing: string[]; canMakeNow: boolean;
  votesThisWeek: number; votedByMe: boolean; isFavorite: boolean;
}

interface RecipeDetail extends RecipeCard {
  scaledServings: number;
  ingredients: { ingredientId: string; name: string; quantity: number; unit: string;
                 isOptional: boolean; toTaste: boolean; inStock: boolean; needsInspection: boolean }[];
  steps: { order: number; text: string; timerMinutes: number | null }[];
}

interface MenuEntry {
  id: string; date: string; meal: Meal; servings: number; order: number;
  recipe: { id: string; name: string; kosherType: KosherType; color: string | null; imageUrl: string | null; prepMinutes: number; status: string };
}

interface ShoppingItem {
  key: string;                 // מפתח לשורה ב־React (key)
  id: string | null;           // null בפריט מהתפריט שעוד לא סומן
  source: 'AUTO' | 'MANUAL' | 'REQUEST';
  status: 'PENDING' | 'OPEN' | 'BOUGHT' | 'DECLINED';
  name: string; category: Department; quantity: number | null; unit: string | null;
  ingredientId: string | null; forRecipes: string[];
  requestedBy: { id: string; name: string } | null;
}

interface Task {
  id: string; title: string; dueDate: string | null; isOverdue: boolean;
  status: 'OPEN' | 'DONE'; isErevShabbat: boolean;
  assignedTo: { id: string; name: string; color: string };
}
```

תאריכים נשלחים ומתקבלים כ־`"YYYY-MM-DD"` (למשל `"2026-10-22"`).
`imageUrl` היא כתובת יחסית: מציגים `<img src={SERVER_URL + imageUrl}>`, כאשר SERVER_URL היא כתובת השרת בלי `/api`.

## 6. מה כל מסך מבקש מהשרת

| מסך | שליפה (useQuery) | שינוי (useMutation) | אחרי שינוי מרעננים |
| --- | --- | --- | --- |
| כניסה | | `POST /auth/login` | |
| הרשמה | | `POST /auth/register` | |
| היום | `GET /today`, `GET /recipes/wheel?mode=ready` | `POST /menu` (מהגלגל), `PATCH /shopping/:id/review` | today |
| מה יש בבית | `GET /pantry` | `PATCH /pantry/:ingredientId` | pantry, shopping, recipes |
| מתכונים | `GET /recipes?…` | `POST/DELETE /recipes/:id/favorite` | recipes |
| מתכון בודד | `GET /recipes/:id?servings=` | `POST/DELETE /recipes/:id/vote`, `PATCH /recipes/:id/status`, `POST /menu` | recipe, menu |
| טופס מתכון | `GET /ingredients`, `GET /recipes/:id` (בעריכה) | `POST /recipes`, `PUT /recipes/:id`, `POST /recipes/:id/image` | recipes |
| תפריט | `GET /menu?week=`, `GET /recipes` | `POST /menu`, `PATCH /menu/:id` (גרירה), `DELETE /menu/:id` | menu, shopping |
| רשימת קניות | `GET /shopping?week=` | `POST /shopping`, `PATCH /shopping/bought`, `POST /shopping/finish`, `PATCH /shopping/:id/review` | shopping, pantry, recipes |
| משימות | `GET /tasks?…`, `GET /tasks/stars`, `GET /task-templates` (מנהלת) | `POST /tasks`, `PATCH /tasks/:id/toggle`, `PATCH/DELETE /tasks/:id`, `POST /tasks/erev-shabbat` | tasks |
| המשפחה | `GET /household`, `GET /household/members` | `PATCH/DELETE /household/members/:id`, `POST /household/invite-code` | household |
| אזור אישי | `GET /auth/me`, `GET /recipes?favorites=true` | `PATCH /auth/me` | me |
| פעמון | `GET /notifications` | `PATCH /notifications/read` | notifications |

## 7. רשימת הנתיבים

הכול מתחיל ב־`/api`. ״כולם״ = כל משתמש מחובר.

| שיטה | נתיב | מי | מה נשלח | מה חוזר |
| --- | --- | --- | --- | --- |
| GET | `/health` | פתוח | | `{ status: "ok" }` |
| POST | `/auth/register` | פתוח | `name, email, password, role`, ו־`managerCode` (רק למנהלת) | `token, user, household` (201) |
| POST | `/auth/login` | פתוח | `email, password` | `token, user` |
| GET | `/auth/me` | כולם | | `user, household, unreadNotifications` |
| PATCH | `/auth/me` | כולם | `name?, color?, currentPassword?, newPassword?` | `user` |
| GET | `/today` | כולם | | נתוני דף הבית |
| GET | `/calendar/week?date=` | כולם | | תאריכים עבריים, פרשה, חגים, הדלקת נרות והבדלה |
| GET | `/household` | כולם | | שם הבית (מנהלת: גם `inviteCode`) |
| GET | `/household/members` | מנהלת | | בני הבית עם `stars` |
| PATCH / DELETE | `/household/members/:id` | מנהלת | `role` | משתמש / 204 |
| POST | `/household/invite-code` | מנהלת | | `inviteCode` חדש |
| GET | `/ingredients?category=&q=` | כולם | | מצרכים |
| POST | `/ingredients` | מנהלת | `name, category, unit, kosherType?, needsInspection?, inStock?` | מצרך (201) |
| PATCH | `/ingredients/:id` | מנהלת | שדות לעדכון | מצרך |
| GET | `/pantry` | כולם | | מחלקות עם מצרכים, יש / אין |
| PATCH | `/pantry/:ingredientId` | כולם* | `{ inStock }` | `addedToShopping` (*בן משפחה רק false) |
| GET | `/recipes` | כולם | פרמטרים בסעיף 8 | `{ total, page, totalPages, items }` |
| GET | `/recipes/wheel?mode=ready\|all` | כולם | | `{ usedFallback, items }` |
| GET | `/recipes/:id?servings=` | כולם | | מתכון מלא |
| POST | `/recipes` | מנהלת | טופס מתכון | מתכון מלא (201) |
| PUT | `/recipes/:id` | מנהלת | טופס מתכון (+ `status?`) | מתכון מלא |
| PATCH | `/recipes/:id/status` | מנהלת | `{ status }` | מתכון מלא |
| GET | `/recipes/:id/image` | פתוח | | קובץ התמונה |
| POST / DELETE | `/recipes/:id/image` | מנהלת | `FormData` עם שדה `image` | `{ imageUrl }` / 204 |
| POST / DELETE | `/recipes/:id/vote` | כולם | | `{ votesThisWeek, votedByMe }` |
| POST / DELETE | `/recipes/:id/favorite` | כולם | | 204 |
| GET | `/menu?week=` | כולם | | ימי השבוע עם הארוחות |
| POST | `/menu` | מנהלת | `date, meal, recipeId, servings?` | שיבוץ + `mixed` (201) |
| PATCH | `/menu/:id` | מנהלת | `date?, meal?, order?, servings?` | שיבוץ + `mixed` |
| DELETE | `/menu/:id` | מנהלת | | 204 |
| GET | `/shopping?week=` | כולם | | `progress, groups, requests` |
| GET | `/shopping/requests` | כולם | | בקשות (מנהלת: כולן, בן משפחה: שלו) |
| POST | `/shopping` | כולם | `name, category, quantity?, unit?, ingredientId?` | פריט (201) |
| PATCH | `/shopping/bought` | כולם | `{ itemId או ingredientId, bought }` | פריט |
| POST | `/shopping/finish` | כולם | `{}` | `{ movedToPantry, message }` |
| PATCH | `/shopping/:id/review` | מנהלת | `{ action: "approve" \| "decline" }` | פריט |
| DELETE | `/shopping/:id` | מנהלת | | 204 |
| GET | `/tasks` | כולם | `status, assignedTo, isErevShabbat, q, sort, order, page` | `{ total, items }` |
| GET | `/tasks/stars` | כולם | | לוח כוכבים |
| POST | `/tasks` | מנהלת | `title, assignedToId, dueDate?` | משימה (201) |
| PATCH / DELETE | `/tasks/:id` | מנהלת | שדות לעדכון | משימה / 204 |
| PATCH | `/tasks/:id/toggle` | כולם* | | משימה (*בן משפחה רק שלו) |
| POST | `/tasks/erev-shabbat` | מנהלת | `{ assignments: [{ templateId, assignedToId }] }` | `{ created, skipped }` (201) |
| GET / POST | `/task-templates` | מנהלת | `title, daysBeforeShabbat (0-2), defaultAssigneeId?` | משימות קבועות |
| DELETE | `/task-templates/:id` | מנהלת | | 204 |
| GET | `/notifications?unreadOnly=` | כולם | | `{ unreadCount, items }` |
| PATCH | `/notifications/read` | כולם | `{ ids? }` | 204 |

## 8. חיפוש, סינון ומיון מתכונים

`GET /recipes?q=עוף&kosherType=MEAT&shabbatFriendly=true&sort=prepMinutes&order=asc&page=1&pageSize=12`

| פרמטר | ערכים |
| --- | --- |
| `q` | חיפוש לפי שם |
| `category` | קטגוריה |
| `kosherType` | `MEAT` / `DAIRY` / `PAREVE` |
| `difficulty` | `EASY` / `MEDIUM` / `HARD` |
| `maxMinutes` | זמן הכנה מקסימלי |
| `shabbatFriendly` | `true` / `false` |
| `ready` | `true` = יש הכול בבית |
| `favorites` | `true` = רק המועדפים שלי |
| `status` | למנהלת: `ACTIVE` (ברירת מחדל) / `ARCHIVED` / `ALL` |
| `sort` | `name` / `prepMinutes` / `match` / `votes` / `createdAt` |
| `order` | `asc` / `desc` |
| `page`, `pageSize` | עמוד (מ־1), כמה בעמוד (עד 100) |

## 9. שדות חובה בטפסים

| טופס | שדות חובה | כללים |
| --- | --- | --- |
| הרשמה | `name`, `email`, `password`, `role` (`MANAGER` / `MEMBER`). ב־`MANAGER` גם `managerCode` | שם 2-30, סיסמה 8+ עם אות וספרה. קוד מנהלת שגוי → 400 |
| כניסה | `email`, `password` | |
| מתכון | `name`, `category`, `kosherType`, `difficulty`, `prepMinutes`, `servings`, `ingredients` (לפחות 1), `steps` (לפחות 1) | שם 2-60, זמן 1-1440, מנות 1-50, תיאור עד 300. מצרך בשרי → מתכון בשרי, מצרך חלבי → חלבי, ובשר עם חלב → שגיאה |
| מצרך במתכון | `ingredientId`, `quantity` | כמות 0 = ״לפי הטעם״ |
| שיבוץ בתפריט | `date`, `meal`, `recipeId` | סעודות שבת רק ביום שבת, סעודת חג רק ביום טוב |
| פריט קניה | `name`, `category` | 1-40 תווים |
| משימה | `title`, `assignedToId` | 2-80 תווים |
| תמונה | קובץ בשדה `image` | JPG או PNG, עד 2MB |

## 10. דוגמאות JSON

**כניסה:**
```json
POST /api/auth/login
{ "email": "member@example.com", "password": "Member123" }

200
{ "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "4c49...", "name": "יוסי", "email": "member@example.com", "role": "MEMBER",
            "color": "#2f6a9e", "householdId": "31fa...", "createdAt": "2026-10-19T19:56:13.830Z" } }
```

**כרטיס מתכון (מתוך `GET /recipes`):**
```json
{ "id": "cd35...", "name": "שקשוקה", "description": "שקשוקה ביתית בסיר אחד",
  "category": "BREAKFAST", "categoryLabel": "ארוחת בוקר", "kosherType": "PAREVE", "kosherLabel": "פרווה",
  "shabbatFriendly": false, "difficulty": "EASY", "difficultyLabel": "קל",
  "prepMinutes": 25, "servings": 4, "color": "#c2410c", "status": "ACTIVE", "imageUrl": null,
  "match": { "have": 6, "total": 7, "percent": 86 }, "missing": ["פלפל אדום"], "canMakeNow": false,
  "votesThisWeek": 0, "votedByMe": false, "isFavorite": true }
```

**מתכון חדש:**
```json
POST /api/recipes
{ "name": "חביתה", "category": "BREAKFAST", "kosherType": "PAREVE", "difficulty": "EASY",
  "prepMinutes": 10, "servings": 2,
  "ingredients": [ { "ingredientId": "…", "quantity": 3 }, { "ingredientId": "…", "quantity": 0 } ],
  "steps": [ { "text": "מטגנים בצל ומוסיפים ביצים", "timerMinutes": 5 } ] }
```

**גרירה בתפריט** (כשעוזבים כרטיס ביום אחר):
```json
PATCH /api/menu/<id>
{ "date": "2026-10-21", "meal": "DINNER" }

200
{ "id": "…", "date": "2026-10-21", "meal": "DINNER", "servings": 4, "order": 0,
  "recipe": { "id": "…", "name": "שניצל עוף", "kosherType": "MEAT", … },
  "mealEntries": 2, "mixed": false }
```

**בקשה לקניות של בן משפחה:**
```json
POST /api/shopping
{ "name": "שוקו", "category": "DAIRY" }

201
{ "key": "055b...", "id": "055b...", "source": "REQUEST", "status": "PENDING", "name": "שוקו",
  "category": "DAIRY", "quantity": null, "unit": null, "ingredientId": null, "forRecipes": [],
  "requestedBy": { "id": "4c49...", "name": "יוסי" }, "boughtBy": null }
```

**סימון ״קניתי״:**
```json
PATCH /api/shopping/bought
{ "ingredientId": "…", "bought": true }      // פריט מהתפריט (source: AUTO)
{ "itemId": "…", "bought": true }            // פריט שנוסף ידנית או בקשה
```

**העלאת תמונה:**
```ts
const form = new FormData();
form.append('image', file);              // file מתוך <input type="file">
// POST /api/recipes/<id>/image עם body: form, ובלי לקבוע Content-Type בעצמך
```

**האתר סגור בשבת:**
```json
503
{ "error": { "code": "SHABBAT", "message": "שבת שלום! האתר סגור עד צאת השבת",
  "details": { "reopensAt": "2026-10-24T15:34:00.000Z", "reopensAtLocal": "18:34" } } }
```
