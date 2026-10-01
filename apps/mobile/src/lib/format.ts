/** Formatage dans le fuseau de l'appareil. */
const time = new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
const longDay = new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long" });

export const fmtTime = (iso: string) => time.format(new Date(iso));
export const fmtDate = (iso: string) => day.format(new Date(iso));
export const fmtLongDay = (d: Date) => longDay.format(d);
export const fmtRange = (start: string, end: string) => `${fmtTime(start)}–${fmtTime(end)}`;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
