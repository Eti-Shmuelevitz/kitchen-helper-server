import { z, ZodIssueCode } from 'zod';

// הודעות שגיאה בעברית לבדיקות הקלט, כשלא הוגדרה הודעה מיוחדת לשדה
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'שדה חובה' };
      return { message: `סוג לא תקין (צריך ${issue.expected === 'number' ? 'מספר' : issue.expected === 'string' ? 'טקסט' : issue.expected === 'boolean' ? 'true / false' : issue.expected === 'array' ? 'רשימה' : issue.expected})` };
    case ZodIssueCode.invalid_enum_value:
      return { message: `ערך לא תקין. אפשר: ${issue.options.join(', ')}` };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: `לפחות ${issue.minimum} תווים` };
      if (issue.type === 'array') return { message: `לפחות ${issue.minimum} פריטים` };
      return { message: `הערך הקטן ביותר: ${issue.minimum}` };
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `עד ${issue.maximum} תווים` };
      if (issue.type === 'array') return { message: `עד ${issue.maximum} פריטים` };
      return { message: `הערך הגדול ביותר: ${issue.maximum}` };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'uuid') return { message: 'מזהה לא תקין' };
      if (issue.validation === 'email') return { message: 'מייל לא תקין' };
      return { message: 'פורמט לא תקין' };
    case ZodIssueCode.unrecognized_keys:
      return { message: `שדות לא מוכרים: ${issue.keys.join(', ')}` };
    default:
      return { message: ctx.defaultError };
  }
});
