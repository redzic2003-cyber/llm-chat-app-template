import {
  addDays,
  formatDateKey,
  localDateKey,
  localTime,
  zonedToUtc,
} from "@tm/analytics";
import type { EnrollmentStatus, SessionStatus } from "@tm/shared-types";

export const SESSION_STATUS: Record<SessionStatus, { label: string; tone: string }> = {
  draft: { label: "Brouillon", tone: "" },
  planned: { label: "Planifiée", tone: "accent" },
  in_progress: { label: "En cours", tone: "warning" },
  completed: { label: "Clôturée", tone: "success" },
  cancelled: { label: "Annulée", tone: "danger" },
};

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, { label: string; tone: string }> = {
  invited: { label: "Invité", tone: "" },
  expected: { label: "À valider", tone: "accent" },
  present: { label: "Présent", tone: "success" },
  absent: { label: "Absent", tone: "danger" },
  excused: { label: "Excusé", tone: "warning" },
};

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Formatage des dates dans le fuseau d'affichage configuré (par défaut Europe/Zurich). */
export function useFormat() {
  const tz = useRuntimeConfig().public.timezone;

  const dateKey = (iso: string) => localDateKey(iso, tz);
  const date = (iso: string) => formatDateKey(localDateKey(iso, tz));
  const time = (iso: string) => localTime(iso, tz);
  const timeRange = (start: string, end: string) => `${time(start)}–${time(end)}`;
  const dateTime = (iso: string) => `${date(iso)} ${time(iso)}`;
  const weekday = (iso: string) => WEEKDAYS[new Date(`${localDateKey(iso, tz)}T12:00:00Z`).getUTCDay()]!;
  const longDate = (iso: string) => `${weekday(iso)} ${date(iso)}`;
  const today = () => localDateKey(new Date(), tz);
  /** `YYYY-MM-DD` + `HH:mm` locaux → ISO UTC. */
  const toUtc = (day: string, hhmm: string) => zonedToUtc(day, hhmm, tz).toISOString();
  const hours = (n: number) => `${n.toLocaleString("fr-CH", { maximumFractionDigits: 1 })} h`;
  const number = (n: number) => n.toLocaleString("fr-CH");
  const bytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);
  const duration = (start: string, end: string) => {
    const minutes = Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? (m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`) : `${m} min`;
  };

  return { tz, dateKey, date, time, timeRange, dateTime, weekday, longDate, today, toUtc, hours, number, bytes, duration, addDays, formatDateKey };
}
