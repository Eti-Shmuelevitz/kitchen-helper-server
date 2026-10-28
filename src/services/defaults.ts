import type { Department, KosherType, Prisma } from '@prisma/client';

// מצרכים בסיסיים שנוספים לכל משק בית חדש, כדי שלא יתחילו מרשימה ריקה
export const DEFAULT_INGREDIENTS: [string, Department, string, KosherType?, boolean?][] = [
  ['עגבניות', 'PRODUCE', 'יח׳'],
  ['מלפפונים', 'PRODUCE', 'יח׳'],
  ['בצל', 'PRODUCE', 'יח׳'],
  ['שום', 'PRODUCE', 'שן'],
  ['תפוחי אדמה', 'PRODUCE', 'יח׳'],
  ['גזר', 'PRODUCE', 'יח׳'],
  ['פלפל אדום', 'PRODUCE', 'יח׳'],
  ['קישואים', 'PRODUCE', 'יח׳'],
  ['לימון', 'PRODUCE', 'יח׳'],
  ['חסה', 'PRODUCE', 'ראש', 'PAREVE', true],
  ['פטרוזיליה', 'PRODUCE', 'צרור', 'PAREVE', true],
  ['שמיר', 'PRODUCE', 'צרור', 'PAREVE', true],
  ['ביצים', 'DAIRY', 'יח׳'],
  ['חלב', 'DAIRY', 'כוס', 'DAIRY'],
  ['גבינה צהובה', 'DAIRY', 'גרם', 'DAIRY'],
  ['גבינה לבנה', 'DAIRY', 'גרם', 'DAIRY'],
  ['שמנת מתוקה', 'DAIRY', 'מ״ל', 'DAIRY'],
  ['חמאה', 'DAIRY', 'גרם', 'DAIRY'],
  ['עוף שלם', 'MEAT', 'יח׳', 'MEAT'],
  ['חזה עוף', 'MEAT', 'גרם', 'MEAT'],
  ['בשר בקר', 'MEAT', 'גרם', 'MEAT'],
  ['סלמון', 'MEAT', 'גרם'],
  ['קמח', 'PANTRY', 'כוס'],
  ['סוכר', 'PANTRY', 'כוס'],
  ['אורז', 'PANTRY', 'כוס', 'PAREVE', true],
  ['פתיתים', 'PANTRY', 'כוס'],
  ['שעועית', 'PANTRY', 'כוס', 'PAREVE', true],
  ['גריסים', 'PANTRY', 'כוס', 'PAREVE', true],
  ['שמן', 'PANTRY', 'כף'],
  ['שוקולד מריר', 'PANTRY', 'גרם'],
  ['אבקת אפייה', 'PANTRY', 'כפית'],
  ['שמרים', 'PANTRY', 'גרם'],
  ['מלח', 'SPICES', 'כפית'],
  ['פלפל שחור', 'SPICES', 'כפית'],
  ['פפריקה', 'SPICES', 'כפית'],
  ['כמון', 'SPICES', 'כפית'],
  ['רסק עגבניות', 'SPICES', 'כף'],
  ['אפונה קפואה', 'FROZEN', 'כוס', 'PAREVE', true],
  ['ברוקולי קפוא', 'FROZEN', 'גרם', 'PAREVE', true],
];

/** יוצר את המצרכים הבסיסיים ואת שורות המלאי שלהם (״אין בבית״) */
export async function createDefaultIngredients(tx: Prisma.TransactionClient, householdId: string): Promise<void> {
  for (const [name, category, unit, kosherType = 'PAREVE', needsInspection = false] of DEFAULT_INGREDIENTS) {
    await tx.ingredient.create({
      data: { householdId, name, category, unit, kosherType, needsInspection, pantryItem: { create: { householdId, inStock: false } } },
    });
  }
}
