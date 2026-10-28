# מתחילות כאן

המדריך הזה מיועד למי שמעולם לא הריצה שרת ולא העלתה שרת לאינטרנט. עברי עליו לפי הסדר.

**חשוב לדעת:** האתרים GitHub, Neon ו־Render משנים מדי פעם את המראה שלהם. שמות הכפתורים כאן נכונים לפי מה שהיה ידוע בזמן הכתיבה, ואי אפשר היה לבדוק את כולם על המסך. אם כפתור נקרא קצת אחרת, חפשי את הכפתור הכי דומה.

**מה נקבל בסוף:** שרת שרץ בכתובת כמו `https://kitchen-helper-server.onrender.com`, עם Swagger בכתובת `/api-docs`.

---

## חלק 0: פתיחה והרצה ב־Visual Studio Code

1. **התקנות (פעם אחת):**
   - Node.js מ־https://nodejs.org (גרסת LTS). אחרי ההתקנה סוגרים ופותחים מחדש את VS Code.
   - Visual Studio Code מ־https://code.visualstudio.com (אם עוד לא מותקן).
2. **פתיחת התיקייה:** ב־VS Code בוחרים **File** ← **Open Folder** ובוחרים את התיקייה `עוזר מטבח`. אם מופיעה שאלה "Do you trust the authors", לוחצים **Yes, I trust**.
   - בפינה מופיעה הצעה להתקין תוספים מומלצים (Prisma, REST Client). כדאי להתקין.
3. **מסד נתונים:** צריך כתובת של מסד. עשי קודם את **חלק א** (Neon) וחזרי לכאן עם הכתובת.
4. **קובץ .env:** בטרמינל של VS Code (**Terminal** ← **New Terminal**) כותבים:
   ```powershell
   copy .env.example .env
   ```
   פותחים את הקובץ `.env` ומשנים שתי שורות:
   - `DATABASE_URL="..."`: מדביקים את הכתובת מ־Neon, בתוך המירכאות.
   - `JWT_SECRET="..."`: מחרוזת ארוכה כלשהי (32 תווים לפחות). אפשר ליצור אחת בטרמינל:
     ```powershell
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
5. **התקנה והרצה**, בטרמינל, שורה אחרי שורה:
   ```powershell
   npm install
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```
   כשמופיע `השרת פועל בכתובת http://localhost:4000`, השרת רץ.
6. **בדיקה:** בדפדפן פותחים http://localhost:4000/api-docs ומתחברים עם `manager@example.com` / `Manager123` (הסבר מלא בחלק ד).
7. **עצירה:** בטרמינל לוחצים **Ctrl+C**.

אם PowerShell כותב שהרצת סקריפטים חסומה (`running scripts is disabled`), פותחים את הטרמינל כ־**Command Prompt** במקום PowerShell (בחץ הקטן ליד ה־**+** בטרמינל), ומריצים שם את אותן פקודות.

---

## חלק א: מסד נתונים (PostgreSQL חינמי)

ההמלצה: **Neon** (https://neon.com). יש לו מסלול חינמי והוא עובד עם Prisma.
אפשר גם Supabase. ב־Render יש מסד חינמי, אבל הוא **נמחק אחרי 30 יום**, ולכן לא מומלץ לפרויקט שצריך להחזיק עד ההגשה.
לפני שמתחילות, בדקי באתר של הספק מה המגבלות של המסלול החינמי היום.

1. **פתיחת חשבון:** ב־neon.com לוחצים **Sign up**. אפשר להירשם עם חשבון GitHub או Google.
2. **יצירת Database:** יוצרים פרויקט חדש (**Create project**).
   - Project name: `kitchen`
   - Region: אזור באירופה (למשל Frankfurt), קרוב לישראל ולשרת.
   - יוצרים.
3. **קבלת Connection String:** בדף הפרויקט לוחצים **Connect**. מופיעה כתובת שמתחילה ב־`postgresql://`.
   - אם יש אפשרות **Connection pooling**, **מכבים** אותה. צריך את הכתובת הישירה, שאין בה את המילה `-pooler`. מיגרציות של Prisma צריכות חיבור ישיר.
   - מוודאים שבסוף הכתובת יש `sslmode=require`.
   - מעתיקים את הכתובת.
4. **שמירה בבטחה:** הכתובת כוללת סיסמה. אל תשלחי אותה לאף אחד ואל תעלי אותה ל־GitHub. המקום שלה הוא רק בקובץ `.env` במחשב (שלא עולה ל־GitHub) ובהגדרות של Render.
5. **חיבור השרת למסד:** הכתובת נכנסת ל־`DATABASE_URL`: בקובץ `.env` להרצה במחשב (חלק 0), וב־Render להרצה בענן (חלק ג). הטבלאות נוצרות לבד בפקודה `prisma migrate deploy`.

אפשר להשתמש באותו מסד גם במחשב וגם ב־Render, וכך הנתונים יהיו זהים.

---

## חלק ב: GitHub

GitHub הוא המקום שבו נשמר הקוד. Render לוקח משם את הקוד ומריץ אותו.

1. **פתיחת חשבון:** נכנסים ל־https://github.com ולוחצים **Sign up**. ממלאים מייל, סיסמה ושם משתמש, ומאשרים את המייל.
2. **יצירת Repository (מאגר):** אחרי ההתחברות לוחצים על **+** בפינה העליונה ובוחרים **New repository**.
   - Repository name: `kitchen-helper-server`
   - בוחרים **Private**.
   - **לא** מסמנים "Add a README file".
   - לוחצים **Create repository**.
3. **חילוץ ה־ZIP** (אם קיבלת ZIP): קליק ימני על הקובץ ← **חלץ הכל** (Extract All).
4. **העלאת הקבצים דרך הדפדפן:**
   - בדף ה־Repository החדש לוחצים על הקישור **uploading an existing file**.
   - פותחים את התיקייה במחשב, מסמנים את **כל מה שבתוכה** (Ctrl+A), וגוררים לחלון של GitHub.
   - **לא** גוררים את התיקיות `node_modules` ו־`dist` ולא את הקובץ `.env`, אם נוצרו אצלך אחרי הרצה במחשב. הם לא צריכים להיות ב־GitHub, ו־`.env` מכיל סיסמאות.
   - גוררים את התוכן של התיקייה, לא את התיקייה עצמה. הקובץ `package.json` צריך להיות בשורש המאגר.
   - קבצים ותיקיות שהשם שלהם מתחיל בנקודה (`.gitignore`, `.env.example`, `.github`, `.vscode`) לפעמים לא נבחרים בגרירה. אם הם חסרים אחרי ההעלאה, לוחצים **Add file** ← **Upload files** ומעלים אותם לבד.
   - למטה לוחצים **Commit changes**.
5. **בדיקה:** בדף המאגר צריך לראות את התיקיות `src`, `prisma`, `tests`, `docs` ואת הקבצים `package.json`, `render.yaml`, `README.md`. נכנסים ל־`prisma/migrations` ומוודאים שיש בפנים תיקייה עם קובץ `migration.sql`.

---

## חלק ג: Render (הרצת השרת בענן)

1. **פתיחת חשבון:** ב־https://render.com לוחצים **Get Started** ונרשמים עם **GitHub**.
2. **חיבור GitHub:** אם Render מבקש גישה למאגרים, בוחרים **Only select repositories**, מסמנים את `kitchen-helper-server` ומאשרים.
3. **יצירת Web Service:** בלוח הבקרה לוחצים **New +** ← **Web Service**.
4. **בחירת המאגר:** בוחרים את `kitchen-helper-server` ולוחצים **Connect**.
5. **הגדרות בנייה והפעלה:**

   | שדה | ערך |
   | --- | --- |
   | Name | `kitchen-helper-server` |
   | Region | Frankfurt (EU Central), כמו המסד |
   | Branch | `main` |
   | Runtime / Language | Node |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npx prisma migrate deploy && npm start` |
   | Instance Type | **Free** |

6. **משתני סביבה:** באזור **Environment Variables** לוחצים **Add Environment Variable** ומוסיפים:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | הכתובת מ־Neon |
   | `JWT_SECRET` | מחרוזת אקראית ארוכה, 32 תווים לפחות (אם יש כפתור **Generate**, השתמשי בו) |
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `22` |
   | `CORS_ORIGINS` | הכתובת של האתר בריאקט, למשל `https://my-kitchen.netlify.app`. כמה כתובות מפרידים בפסיק. לבדיקות בהתחלה אפשר `*` |
   | `PUBLIC_URL` | הכתובת ש־Render ייתן לשרת (אפשר לעדכן אחרי ה־Deploy הראשון) |
   | `SHABBAT_GUARD` | `true` |
   | `MANAGER_CODE` | קוד המנהלת, למשל `1357` |

7. **Prisma Migrations:** אין צורך לעשות משהו מיוחד. ה־Start Command מריץ `prisma migrate deploy` בכל עלייה, וזה יוצר או מעדכן את הטבלאות.
8. **Deploy:** לוחצים **Create Web Service** (או **Deploy Web Service**). בלשונית **Logs** רואים את ההתקדמות. זה לוקח כמה דקות.
   כשמופיע `השרת פועל בכתובת...` ו־`Your service is live`, השרת באוויר.
9. **חשבונות:** ב־Production אין משתמשים לדוגמה עם סיסמאות ידועות. נרשמים דרך Swagger: `POST /api/auth/register`, עם `"role": "MANAGER"` וקוד המנהלת (`MANAGER_CODE`). בני המשפחה נרשמים עם `"role": "MEMBER"`, בלי קוד.
   - אם השתמשת באותו מסד גם במחשב והרצת שם `npm run db:seed`, משתמשי הדוגמה כבר קיימים וגם הם יעבדו.
10. **בדיקה שהשרת פעיל:** פותחים `https://<השם שלך>.onrender.com/api/health`. צריך לראות `"status":"ok"`.

**שימי לב:** שירות חינמי ב־Render ״נרדם״ אחרי זמן בלי שימוש, והבקשה הראשונה אחרי זה לוקחת בערך דקה. זה תקין.

---

## חלק ד: בדיקה מלאה מתוך Swagger

1. **בריאות:** `/api/health` מחזיר `status: ok`.
2. **Swagger:** פותחים `/api-docs`. מופיעה רשימה של כל הנתיבים לפי נושאים.
3. **התחברות:** פותחים `POST /api/auth/login` ← **Try it out**. כותבים מייל וסיסמה (למשל `manager@example.com` / `Manager123`) ולוחצים **Execute**.
4. **קבלת JWT:** בתשובה מופיע `"token": "eyJ..."`. מעתיקים את הערך בלי המירכאות.
5. **Authorize:** לוחצים על הכפתור **Authorize** למעלה, מדביקים את ה־token (בלי המילה Bearer), לוחצים **Authorize** ואז **Close**.
6. **קריאה לנתיב מוגן:** `GET /api/auth/me` ← **Try it out** ← **Execute**. צריך לחזור 200.
   - **401:** לוחצים **Authorize** ← **Logout** ומריצים שוב. צריך לחזור 401.
   - **403:** מתחברים כ־`member@example.com` / `Member123`, עושים Authorize עם ה־token שלו, ומנסים `POST /api/recipes`. צריך לחזור 403.
7. **הוספת רשומה:** מתחברים שוב כמנהלת. מריצים `GET /api/ingredients` ומעתיקים `id` של שני מצרכים (למשל ביצים ובצל). אחר כך `POST /api/recipes` עם:
   ```json
   {
     "name": "חביתה",
     "category": "BREAKFAST",
     "kosherType": "PAREVE",
     "difficulty": "EASY",
     "prepMinutes": 10,
     "servings": 2,
     "ingredients": [
       { "ingredientId": "המזהה של ביצים", "quantity": 3 },
       { "ingredientId": "המזהה של בצל", "quantity": 1 }
     ],
     "steps": [{ "text": "מטגנים בצל ומוסיפים ביצים", "timerMinutes": 5 }]
   }
   ```
   צריך לחזור 201.
8. **שליפה מהמסד:** `GET /api/recipes?q=חביתה` מחזיר את המתכון החדש. אפשר לראות אותו גם ב־Neon, ב־**Tables** ← `Recipe`.

---

## חלק ה: פתרון תקלות

| מה רואים | מה כנראה הבעיה | מה עושים |
| --- | --- | --- |
| `npm` לא מוכר בטרמינל | Node.js לא מותקן, או ש־VS Code לא נפתח מחדש אחרי ההתקנה | מתקינים Node.js, סוגרים את VS Code לגמרי ופותחים מחדש |
| `running scripts is disabled` ב־PowerShell | הגבלה של Windows | מריצים את הפקודות ב־Command Prompt (ראו חלק 0) |
| **Build failed** ב־Render | הקבצים לא בשורש המאגר, או ש־`package.json` חסר | ב־GitHub, `package.json` חייב להיות בדף הראשי של המאגר. אם הוא בתוך תיקייה, ב־Render מגדירים **Root Directory** לשם התיקייה |
| Build failed עם `tsc: not found` | חבילות הפיתוח לא הותקנו | ה־Build Command צריך להיות בדיוק `npm ci --include=dev && npm run build` |
| `DATABASE_URL חסר` או `Can't reach database server` | הכתובת חסרה או שגויה | בדקי שהערך הועתק במלואו, בלי רווחים, ושיש בסוף `sslmode=require` |
| `P1001` / `P1000` (שגיאות Prisma) | אין חיבור למסד, או סיסמה שגויה | העתיקי שוב את הכתובת מ־Neon. מסד חינמי יכול ״להירדם״, ונסיון נוסף אחרי דקה בדרך כלל עובד |
| `migrate deploy` נכשל עם הודעה על pooler | השתמשת בכתובת עם `-pooler` | קחי מ־Neon את הכתובת הישירה (בלי pooling) |
| `JWT_SECRET חייב להיות באורך 32 תווים לפחות` | הסוד קצר או חסר | מחרוזת ארוכה יותר ב־`JWT_SECRET`, ואז הפעלה מחדש (ב־Render: **Manual Deploy**) |
| שגיאת **CORS** בדפדפן של אתר הריאקט | הכתובת של האתר לא מופיעה ב־`CORS_ORIGINS` | הוסיפי את הכתובת המדויקת (עם `https://` או `http://localhost:5173`, בלי `/` בסוף) והפעילי מחדש |
| **401** | לא התחברת, או שה־token פג (תוקף 7 ימים) | התחברי שוב ולחצי Authorize עם ה־token החדש |
| **403** | אין הרשאה: בן משפחה מנסה פעולה של מנהלת | זה תקין. בדקי בטבלת ההרשאות ב־`FRONTEND-API-GUIDE.md` |
| **503** עם `SHABBAT` | שבת או חג | זה תקין: האתר נפתח בצאת השבת. בתשובה כתובה השעה |
| **404** על מתכון שקיים | המתכון שייך לבית אחר | כל בית רואה רק את הנתונים שלו |
| Swagger לא נפתח | השרת עוד לא עלה, או שהוא ״ישן״ | פתחי קודם את `/api/health`, חכי דקה, ואז את `/api-docs` |
| השרת לא עולה | חסר משתנה סביבה | חפשי בלוג את השורה `שגיאה בהגדרות הסביבה`, שם כתוב איזה משתנה חסר |
| `npm run db:seed` כותב שכבר יש נתונים | ה־seed רץ רק על מסד ריק | כדי להתחיל מחדש (מוחק הכול!): `npm run db:reset` |
