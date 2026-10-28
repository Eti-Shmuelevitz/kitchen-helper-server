# מסד הנתונים

PostgreSQL דרך Prisma. המבנה המלא: `prisma/schema.prisma`. לכל טבלה מפתח ראשי `id` (UUID).
כל טבלה ששייכת למשפחה כוללת `householdId`, וכל שאילתה בשרת מסננת לפיו. כך משפחה אחת לא רואה נתונים של אחרת.

## 15 טבלאות

| טבלה | מה היא | שדות | קשרים (Foreign Keys) | אילוצים |
| --- | --- | --- | --- | --- |
| Household | משק בית (משפחה) | name *, inviteCode *, createdAt * | — | inviteCode ייחודי |
| User | משתמש: מנהלת הבית או בן משפחה | householdId *, name *, email *, passwordHash *, role *, color *, createdAt *, updatedAt * | householdId → Household (Cascade) | email ייחודי<br>@@index([householdId]) |
| Ingredient | מצרך של הבית | householdId *, name *, category *, unit *, kosherType *, needsInspection *, createdAt * | householdId → Household (Cascade) | @@unique([householdId, name]) |
| PantryItem | פריט במלאי: יש / אין | householdId *, ingredientId *, inStock *, updatedById, updatedAt * | householdId → Household (Cascade)<br>ingredientId → Ingredient (Cascade)<br>updatedById → User (SetNull) | ingredientId ייחודי<br>@@index([householdId]) |
| Recipe | מתכון (האובייקט המרכזי) | householdId *, name *, description, category *, kosherType *, shabbatFriendly *, difficulty *, prepMinutes *, servings *, color, status *, createdById, createdAt *, updatedAt * | householdId → Household (Cascade)<br>createdById → User (SetNull) | @@unique([householdId, name])<br>@@index([householdId, status]) |
| RecipeImage | תמונת מתכון | recipeId *, mimeType *, data *, updatedAt * | recipeId → Recipe (Cascade) | recipeId ייחודי |
| RecipeIngredient | מצרך בתוך מתכון | recipeId *, ingredientId *, quantity *, unit *, isOptional * | recipeId → Recipe (Cascade)<br>ingredientId → Ingredient (Restrict) | @@unique([recipeId, ingredientId]) |
| RecipeStep | שלב הכנה | recipeId *, order *, text *, timerMinutes | recipeId → Recipe (Cascade) | @@unique([recipeId, order]) |
| MenuEntry | שיבוץ מתכון בתפריט | householdId *, date *, meal *, recipeId *, servings *, order *, addedById, createdAt * | householdId → Household (Cascade)<br>recipeId → Recipe (Restrict)<br>addedById → User (SetNull) | @@index([householdId, date]) |
| ShoppingItem | פריט ברשימת הקניות או בקשה | householdId *, source *, status *, name *, category *, quantity, unit, ingredientId, weekStart, requestedById, reviewedById, reviewedAt, boughtById, boughtAt, createdAt * | householdId → Household (Cascade)<br>ingredientId → Ingredient (SetNull)<br>requestedById → User (SetNull)<br>reviewedById → User (SetNull)<br>boughtById → User (SetNull) | @@index([householdId, status]) |
| Vote | הצבעה ״רוצה את זה השבוע״ | recipeId *, userId *, weekStart *, createdAt * | recipeId → Recipe (Cascade)<br>userId → User (Cascade) | @@unique([recipeId, userId, weekStart]) |
| Favorite | מתכון מועדף | recipeId *, userId *, createdAt * | recipeId → Recipe (Cascade)<br>userId → User (Cascade) | @@unique([recipeId, userId]) |
| Task | משימה | householdId *, title *, dueDate, status *, completedAt, isErevShabbat *, templateId, assignedToId *, createdById, createdAt *, updatedAt * | householdId → Household (Cascade)<br>assignedToId → User (Cascade)<br>createdById → User (SetNull)<br>templateId → TaskTemplate (SetNull) | @@index([householdId, status])<br>@@index([assignedToId]) |
| TaskTemplate | משימה קבועה לערב שבת | householdId *, title *, daysBeforeShabbat *, defaultAssigneeId, createdAt * | householdId → Household (Cascade)<br>defaultAssigneeId → User (SetNull) | — |
| Notification | התראה בפעמון | userId *, type *, text *, link, isRead *, createdAt * | userId → User (Cascade) | @@index([userId, isRead]) |

`*` = שדה חובה.

## ערכי בחירה (Enums)

- **Role:** MANAGER = מנהלת הבית, MEMBER = בן / בת משפחה
- **Department:** PRODUCE = ירקות ופירות, DAIRY = חלב וביצים, MEAT = בשר, עוף ודגים, PANTRY = מזווה ויבשים, SPICES = תבלינים ורטבים, FROZEN = קפואים ואחר
- **KosherType:** MEAT = בשרי, DAIRY = חלבי, PAREVE = פרווה
- **RecipeCategory:** MAIN = מנה עיקרית, SIDE = תוספת, SALAD = סלט, SOUP = מרק, DESSERT = קינוח, BAKED = מאפה, BREAKFAST = ארוחת בוקר, SHABBAT_HOLIDAY = מנה לשבת ולחג
- **Difficulty:** EASY, MEDIUM, HARD
- **RecipeStatus:** ACTIVE, ARCHIVED
- **Meal:** BREAKFAST = בוקר, LUNCH = צהריים, DINNER = ערב, SHABBAT_NIGHT = ליל שבת, SHABBAT_DAY = סעודת שבת, SEUDA_SHLISHIT = סעודה שלישית, YOM_TOV = סעודת חג
- **ShoppingSource:** AUTO = נוצר מהתפריט, MANUAL = נוסף ידנית או כש״נגמר״ במלאי, REQUEST = בקשה של בן משפחה
- **ShoppingStatus:** PENDING = בקשה שממתינה לאישור, OPEN = צריך לקנות, BOUGHT = נקנה, DECLINED = בקשה שנדחתה
- **TaskStatus:** OPEN, DONE
- **NotificationType:** SHOPPING_REQUEST, REQUEST_APPROVED, REQUEST_DECLINED, TASK_ASSIGNED, TASK_DONE

## קשרים עיקריים

- משק בית אחד ← הרבה משתמשים, מצרכים, מתכונים, שיבוצים, פריטי קניה, משימות ומשימות קבועות.
- מתכון אחד ← הרבה מצרכים במתכון, שלבים, שיבוצים, הצבעות ומועדפים, ותמונה אחת.
- מצרך אחד ← שורת מלאי אחת, ומופיע בהרבה מתכונים.
- משתמש אחד ← הרבה משימות, בקשות, הצבעות, מועדפים והתראות.

## כללי מחיקה

- מחיקת מתכון מוחקת את המצרכים, השלבים, התמונה, ההצבעות והמועדפים שלו. אבל מתכון שמשובץ בתפריט לא נמחק (Restrict). לכן מעבירים מתכונים לארכיון ולא מוחקים.
- מצרך שמופיע במתכון לא נמחק (Restrict).
- הסרת בן בית מוחקת את המשימות, ההצבעות, המועדפים וההתראות שלו. בשדות כמו ״נוצר על ידי״ נשאר ריק (SetNull).
