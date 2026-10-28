// שגיאה עם קוד HTTP וקוד קבוע שהצד של React יכול לבדוק
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'צריך להתחבר') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'אין לך הרשאה לפעולה הזו') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'לא נמצא') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);
