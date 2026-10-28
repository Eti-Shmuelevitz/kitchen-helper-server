import { DAY_NAMES, getWeekStart, todayIso } from '../../utils/dates';
import { getWeekCalendar } from '../../utils/hebcal';

/** תאריכים עבריים, פרשת השבוע, ימי חג וזמני השבת לשבוע שבו נמצא התאריך */
export function week(date?: string) {
  const cal = getWeekCalendar(getWeekStart(date ?? todayIso()));
  const today = todayIso();
  return { ...cal, days: cal.days.map((d) => ({ ...d, dayName: DAY_NAMES[d.dayOfWeek], isToday: d.date === today })) };
}
