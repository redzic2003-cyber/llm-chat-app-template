/**
 * Données initiales.
 * - `seedAdmin` : crée le premier administrateur (obligatoire en production).
 * - `seedDemo` : jeu de démonstration réaliste (formations, participants, sessions
 *   passées et à venir, présences) pour explorer le dashboard. Jamais en production.
 */
import { addDays, localDateKey, zonedToUtc } from "@tm/analytics";
import { count, eq } from "drizzle-orm";
import type { AppDatabase } from "../src/client";
import { newId } from "../src/ids";
import { hashPassword } from "../src/password";
import {
  attendanceValidations,
  auditLogs,
  enrollments,
  participants,
  trainingSessions,
  trainings,
  users,
} from "../schema/schema";

export interface SeedAdminOptions {
  email: string;
  password: string;
  displayName?: string;
}

export async function seedAdmin(db: AppDatabase, options: SeedAdminOptions): Promise<{ created: boolean; id: string }> {
  const email = options.email.trim().toLowerCase();
  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existing) return { created: false, id: existing.id };
  if (options.password.length < 12) throw new Error("Le mot de passe administrateur doit contenir au moins 12 caractères.");
  const now = new Date().toISOString();
  const id = newId();
  db.insert(users)
    .values({
      id,
      email,
      displayName: options.displayName ?? "Administrateur",
      role: "admin",
      passwordHash: await hashPassword(options.password),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(auditLogs)
    .values({ id: newId(), actorUserId: null, action: "USER_CREATED", entityType: "user", entityId: id, timestamp: now, metadataJson: JSON.stringify({ role: "admin", source: "seed" }) })
    .run();
  return { created: true, id };
}

/** PRNG déterministe (mulberry32) pour un jeu de démo reproductible. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Jean", "Marc", "Luc", "Paul", "Sophie", "Claire", "Julie", "Nicolas", "Thomas", "Laura",
  "Céline", "David", "Sarah", "Pierre", "Nathalie", "Yves", "Camille", "Olivier", "Elodie", "Patrick",
  "Isabelle", "Fabien", "Mélanie", "Sébastien", "Aline", "Cédric", "Valérie", "Romain", "Anne", "Michel",
];
const LAST_NAMES = [
  "Dupont", "Martin", "Robert", "Simon", "Favre", "Rochat", "Bonvin", "Perrin", "Morel", "Girard",
  "Meyer", "Muller", "Blanc", "Rey", "Fontaine", "Chevalley", "Monnier", "Python", "Cuche", "Jaquet",
  "Bersier", "Gay", "Rossier", "Mottier", "Burnier", "Pittet", "Roulin", "Chappuis", "Vuilleumier", "Gilliéron",
];
const DEPARTMENTS = ["Production", "Logistique", "Maintenance", "Qualité", "Administration"];

const DEMO_TRAININGS = [
  { reference: "SEC-INC-01", title: "Sécurité incendie", minutes: 120, description: "Prévention, alarme, évacuation et manipulation des extincteurs." },
  { reference: "TRH-01", title: "Travail en hauteur", minutes: 180, description: "Port du harnais, points d'ancrage, plateformes élévatrices." },
  { reference: "SAU-CAM-01", title: "Sauvetage camarade", minutes: 90, description: "Premiers secours et alerte en cas d'accident." },
  { reference: "QHS-15", title: "1/4 heure sécurité", minutes: 15, description: "Rappel sécurité hebdomadaire en atelier." },
  { reference: "CHM-01", title: "Conduite chariot élévateur", minutes: 240, description: "Recyclage cariste." },
];

const LOCATIONS = ["Local EHS", "Salle de conférence B", "Atelier 2", "Halle logistique"];

export interface SeedDemoOptions {
  password: string;
  timezone: string;
  now?: Date;
}

export async function seedDemo(db: AppDatabase, options: SeedDemoOptions): Promise<{ skipped: boolean; sessions: number }> {
  const existing = db.select({ n: count() }).from(trainings).get();
  if ((existing?.n ?? 0) > 0) return { skipped: true, sessions: 0 };

  const rand = prng(20261001);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const tz = options.timezone;
  const passwordHash = await hashPassword(options.password);

  const staff = [
    { email: "formateur@example.ch", displayName: "Claire Fontaine", role: "trainer" as const },
    { email: "formateur2@example.ch", displayName: "Marc Rochat", role: "trainer" as const },
    { email: "direction@example.ch", displayName: "Direction", role: "viewer" as const },
  ];
  const trainerIds: string[] = [];
  for (const s of staff) {
    const found = db.select({ id: users.id }).from(users).where(eq(users.email, s.email)).get();
    const id = found?.id ?? newId();
    if (!found) db.insert(users).values({ id, ...s, passwordHash, createdAt: nowIso, updatedAt: nowIso }).run();
    if (s.role === "trainer") trainerIds.push(id);
  }

  const trainingRows = DEMO_TRAININGS.map((t) => ({
    id: newId(),
    reference: t.reference,
    title: t.title,
    description: t.description,
    defaultDurationMinutes: t.minutes,
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
  db.insert(trainings).values(trainingRows).run();

  const participantRows = Array.from({ length: 48 }, (_, i) => ({
    id: newId(),
    employeeRef: `E${1001 + i}`,
    // Décalage par tranche de 30 : aucun homonyme dans le jeu de démo.
    firstName: FIRST_NAMES[(i + Math.floor(i / FIRST_NAMES.length) * 7) % FIRST_NAMES.length]!,
    lastName: LAST_NAMES[(i * 7) % LAST_NAMES.length]!,
    department: DEPARTMENTS[i % DEPARTMENTS.length]!,
    email: null,
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
  db.insert(participants).values(participantRows).run();

  const today = localDateKey(now, tz);
  let sessionsCreated = 0;

  db.transaction((tx) => {
    for (let offset = -120; offset <= 21; offset++) {
      const day = addDays(today, offset);
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      // Environ 1 à 2 sessions par jour ouvré, plus dense dans les dernières semaines.
      const slots = rand() < 0.45 ? 0 : rand() < 0.7 ? 1 : 2;
      for (let slot = 0; slot < slots; slot++) {
        const index = Math.floor(rand() * trainingRows.length);
        const training = trainingRows[index]!;
        const minutes = DEMO_TRAININGS[index]!.minutes;
        const startTime = slot === 0 ? "08:00" : "13:30";
        const startsAt = zonedToUtc(day, startTime, tz);
        const endsAt = new Date(startsAt.getTime() + minutes * 60_000);
        const ended = endsAt <= now;
        const started = startsAt <= now;
        const status = ended ? (rand() < 0.04 ? "cancelled" : "completed") : started ? "in_progress" : "planned";
        const sessionId = newId();
        const trainerId = pick(trainerIds);
        tx.insert(trainingSessions)
          .values({
            id: sessionId,
            trainingId: training.id,
            trainerId,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            location: pick(LOCATIONS),
            status,
            notes: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          })
          .run();
        sessionsCreated++;

        const size = 5 + Math.floor(rand() * 8);
        const chosen = new Set<number>();
        while (chosen.size < size) chosen.add(Math.floor(rand() * participantRows.length));
        for (const pIndex of chosen) {
          const enrollmentId = newId();
          let enrollmentStatus: "expected" | "present" | "absent" | "excused" = "expected";
          if (status === "completed") {
            const r = rand();
            enrollmentStatus = r < 0.9 ? "present" : r < 0.96 ? "absent" : "excused";
          } else if (status === "in_progress" && rand() < 0.6) {
            enrollmentStatus = "present";
          } else if (status === "cancelled") {
            enrollmentStatus = "excused";
          }
          tx.insert(enrollments)
            .values({
              id: enrollmentId,
              sessionId,
              participantId: participantRows[pIndex]!.id,
              status: enrollmentStatus,
              createdAt: nowIso,
              updatedAt: nowIso,
            })
            .run();
          if (enrollmentStatus === "present") {
            const validatedAt = new Date(Math.min(now.getTime(), startsAt.getTime() + Math.floor(rand() * 20) * 60_000));
            tx.insert(attendanceValidations)
              .values({
                id: newId(),
                enrollmentId,
                validatedBy: trainerId,
                validatedAt: validatedAt.toISOString(),
                method: rand() < 0.92 ? "qr" : "manual",
                idempotencyKey: newId(),
              })
              .run();
          }
        }
      }
    }
  });

  return { skipped: false, sessions: sessionsCreated };
}
