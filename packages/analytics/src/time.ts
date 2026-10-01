/**
 * Utilitaires de dates sans dépendance externe.
 *
 * En base, tout est en UTC. Les regroupements (jour, semaine ISO, mois) et les
 * périodes de rapports se font dans le fuseau d'affichage (par défaut Europe/Zurich),
 * sinon une session à 00:30 locale serait comptée la veille.
 */

export const DEFAULT_TIMEZONE = "Europe/Zurich";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(value: Date | string | number, timeZone: string): ZonedParts {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(toDate(value))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

/** Décalage du fuseau par rapport à UTC, en minutes, à l'instant donné. */
export function timeZoneOffsetMinutes(value: Date | string | number, timeZone: string): number {
  const date = toDate(value);
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60_000);
}

export function isValidDateKey(key: string): boolean {
  const m = DATE_KEY.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function parseDateKey(key: string): [number, number, number] {
  const m = DATE_KEY.exec(key);
  if (!m || !isValidDateKey(key)) throw new Error(`Date invalide : ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Convertit une date + heure locales (dans `timeZone`) en instant UTC. */
export function zonedToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [y, mo, d] = parseDateKey(dateKey);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!tm) throw new Error(`Heure invalide : ${time}`);
  const guess = Date.UTC(y, mo - 1, d, Number(tm[1]), Number(tm[2]));
  const offset = timeZoneOffsetMinutes(guess, timeZone);
  let utc = guess - offset * 60_000;
  const corrected = timeZoneOffsetMinutes(utc, timeZone);
  if (corrected !== offset) utc = guess - corrected * 60_000;
  return new Date(utc);
}

/** `YYYY-MM-DD` local d'un instant. */
export function localDateKey(value: Date | string | number, timeZone: string): string {
  const p = zonedParts(value, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** `HH:mm` local d'un instant. */
export function localTime(value: Date | string | number, timeZone: string): string {
  const p = zonedParts(value, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayKey(timeZone: string, now: Date = new Date()): string {
  return localDateKey(now, timeZone);
}

export function addDays(key: string, days: number): string {
  const [y, mo, d] = parseDateKey(key);
  const date = new Date(Date.UTC(y, mo - 1, d) + days * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = parseDateKey(from);
  const [y2, m2, d2] = parseDateKey(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(key: string): number {
  const [y, mo, d] = parseDateKey(key);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay() || 7;
}

export function isoWeek(key: string): { year: number; week: number } {
  const [y, mo, d] = parseDateKey(key);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const day = date.getUTCDay() || 7;
  // Le jeudi de la semaine détermine l'année ISO.
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return { year, week };
}

/** `2026-W40` */
export function isoWeekKey(key: string): string {
  const { year, week } = isoWeek(key);
  return `${year}-W${pad(week)}`;
}

/** `2026-09` */
export function monthKey(key: string): string {
  parseDateKey(key);
  return key.slice(0, 7);
}

export function startOfIsoWeek(key: string): string {
  return addDays(key, 1 - isoWeekday(key));
}

export function endOfMonth(key: string): string {
  const [y, mo] = parseDateKey(key);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return `${y}-${pad(mo)}-${pad(last)}`;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) out.push(key);
  return out;
}

function uniqueInOrder(keys: string[]): string[] {
  return [...new Set(keys)];
}

export function eachWeek(from: string, to: string): string[] {
  return uniqueInOrder(eachDay(from, to).map(isoWeekKey));
}

export function eachMonth(from: string, to: string): string[] {
  return uniqueInOrder(eachDay(from, to).map(monthKey));
}

export interface DateRange {
  from: string;
  to: string;
}

/** Bornes UTC `[start, end[` d'une période locale incluse `from..to`. */
export function periodToUtcRange(period: DateRange, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedToUtc(period.from, "00:00", timeZone),
    end: zonedToUtc(addDays(period.to, 1), "00:00", timeZone),
  };
}

export const PERIOD_PRESETS = ["7d", "30d", "week", "month", "last-month", "quarter", "year"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export function presetPeriod(preset: PeriodPreset, today: string): DateRange {
  const [y, mo] = parseDateKey(today);
  switch (preset) {
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "week": {
      const from = startOfIsoWeek(today);
      return { from, to: addDays(from, 6) };
    }
    case "month": {
      const from = `${y}-${pad(mo)}-01`;
      return { from, to: endOfMonth(from) };
    }
    case "last-month": {
      const prev = addDays(`${y}-${pad(mo)}-01`, -1);
      return { from: `${prev.slice(0, 7)}-01`, to: prev };
    }
    case "quarter": {
      const startMonth = Math.floor((mo - 1) / 3) * 3 + 1;
      const from = `${y}-${pad(startMonth)}-01`;
      return { from, to: endOfMonth(`${y}-${pad(startMonth + 2)}-01`) };
    }
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** `15.10.2026` */
export function formatDateKey(key: string): string {
  const [y, mo, d] = parseDateKey(key);
  return `${pad(d)}.${pad(mo)}.${y}`;
}

export function monthLabel(key: string): string {
  const [y, mo] = parseDateKey(key.length === 7 ? `${key}-01` : key);
  const name = MONTHS_FR[mo - 1]!;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** Libellé humain d'une période de rapport. */
export function periodLabel(type: "weekly" | "monthly" | "yearly" | "custom", period: DateRange): string {
  switch (type) {
    case "weekly": {
      const { year, week } = isoWeek(period.from);
      return `Semaine ${week} · ${year}`;
    }
    case "monthly":
      return monthLabel(period.from);
    case "yearly":
      return `Année ${period.from.slice(0, 4)}`;
    case "custom":
      return `${formatDateKey(period.from)} – ${formatDateKey(period.to)}`;
  }
}
