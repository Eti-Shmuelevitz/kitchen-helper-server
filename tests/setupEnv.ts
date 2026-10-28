// משתני סביבה לבדיקות. מסד בדיקות נפרד: TEST_DATABASE_URL
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/kitchen_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-that-is-long-enough-for-hs256-0123456789';
process.env.CORS_ORIGINS = 'http://localhost:5173';
// בבדיקות הרגילות האתר לא נסגר בשבת (כדי שהבדיקות יעברו בכל יום). סגירת השבת נבדקת בנפרד ב־shabbat.test.ts
process.env.SHABBAT_GUARD = 'false';
