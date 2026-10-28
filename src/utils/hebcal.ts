import { HDate, HebrewCalendar, Location, flags, type Event } from '@hebcal/core';
import { addDays, dayOfWeek, getWeekDates, localTime, todayIso } from './dates';

// לוח עברי בעזרת הספרייה @hebcal/core: תאריך עברי, פרשת השבוע, חגים וזמני שבת (ירושלים, לוח ארץ ישראל).

const JERUSALEM = Location.lookup('Jerusalem');
const HE = 'he-x-NoNikud';

/** HDate עובד עם רכיבי תאריך מקומיים, ולכן בונים Date מקומי מהמחרוזת */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function isoOf(e: Event): string {
  const g = e.getDate().greg();
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
}

function eventsBetween(startIso: string, endIso: string, withTimes: boolean): Event[] {
  return HebrewCalendar.calendar({
    start: localDate(startIso),
    end: localDate(endIso),
    il: true,
    location: JERUSALEM,
    candlelighting: withTimes,
    sedrot: true,
    noModern: true,
    noSpecialShabbat: true,
  });
}

const isCandle = (e: Event) => e.getDesc() === 'Candle lighting';
const isHavdalah = (e: Event) => e.getDesc() === 'Havdalah';
const eventTime = (e: Event): Date | undefined => (e as Event & { eventTime?: Date }).eventTime;

/** getHebrewDate: למשל ״י״ג חשון תשפ״ז״ */
export function getHebrewDate(iso: string): string {
  return new HDate(localDate(iso)).renderGematriya(true);
}

/** getParasha: שם פרשת השבוע של השבת שבתאריך הנתון (או null בשבת שהיא חג) */
export function getParasha(shabbatIso: string): string | null {
  const ev = eventsBetween(shabbatIso, shabbatIso, false).find((e) => e.getFlags() & flags.PARSHA_HASHAVUA);
  return ev ? ev.render(HE) : null;
}

export interface DayInfo {
  date: string;
  dayOfWeek: number;
  hebrewDate: string;
  holidays: string[];
  isYomTov: boolean;
  isShabbat: boolean;
}

/** getHolidaysInWeek + פרטי כל יום בשבוע, וזמני השבת של אותו שבוע */
export function getWeekCalendar(weekStart: string) {
  const dates = getWeekDates(weekStart);
  const events = eventsBetween(dates[0]!, dates[6]!, true);
  const days: DayInfo[] = dates.map((date) => {
    const onDay = events.filter((e) => isoOf(e) === date);
    const holidays = onDay.filter((e) => !isCandle(e) && !isHavdalah(e) && !(e.getFlags() & flags.PARSHA_HASHAVUA)).map((e) => e.render(HE));
    return {
      date,
      dayOfWeek: dayOfWeek(date),
      hebrewDate: getHebrewDate(date),
      holidays,
      isYomTov: onDay.some((e) => (e.getFlags() & flags.CHAG) && !isCandle(e) && !isHavdalah(e)),
      isShabbat: dayOfWeek(date) === 6,
    };
  });
  const parashaEv = events.find((e) => e.getFlags() & flags.PARSHA_HASHAVUA);
  const candle = events.filter(isCandle).map(eventTime).filter(Boolean) as Date[];
  const havdalah = events.filter(isHavdalah).map(eventTime).filter(Boolean) as Date[];
  return {
    weekStart,
    parasha: parashaEv ? parashaEv.render(HE) : null,
    days,
    holidayDates: days.filter((d) => d.isYomTov).map((d) => d.date),
    candleLighting: candle.map((t) => ({ at: t.toISOString(), local: localTime(t), date: todayIso(t) })),
    havdalah: havdalah.map((t) => ({ at: t.toISOString(), local: localTime(t), date: todayIso(t) })),
  };
}

/** האם התאריך הוא יום טוב (חג שאסור בו במלאכה) */
export function isYomTov(iso: string): boolean {
  return eventsBetween(iso, iso, false).some((e) => e.getFlags() & flags.CHAG);
}

export interface ShabbatState {
  closed: boolean;
  reopensAt: Date | null;
  reopensAtLocal: string | null;
}

/**
 * isShabbatOrYomTov: בודקת אם הרגע הנתון בין הדלקת נרות להבדלה (שבת או חג, זמני ירושלים).
 * האירוע האחרון שכבר עבר קובע: אם הוא הדלקת נרות, האתר סגור עד ההבדלה הבאה.
 */
export function isShabbatOrYomTov(now: Date): ShabbatState {
  const today = todayIso(now);
  const timed = eventsBetween(addDays(today, -3), addDays(today, 3), true)
    .filter((e) => (isCandle(e) || isHavdalah(e)) && eventTime(e))
    .sort((a, b) => eventTime(a)!.getTime() - eventTime(b)!.getTime());
  const past = timed.filter((e) => eventTime(e)!.getTime() <= now.getTime());
  const last = past[past.length - 1];
  if (!last || !isCandle(last)) return { closed: false, reopensAt: null, reopensAtLocal: null };
  const next = timed.find((e) => isHavdalah(e) && eventTime(e)!.getTime() > now.getTime());
  const reopensAt = next ? eventTime(next)! : null;
  return { closed: true, reopensAt, reopensAtLocal: reopensAt ? localTime(reopensAt) : null };
}
