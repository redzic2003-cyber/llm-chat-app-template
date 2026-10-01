import { describe, expect, it } from "vitest";
import {
  attendanceValidateSchema,
  participantCreateSchema,
  reportCreateSchema,
  scanResolveSchema,
  sessionCreateSchema,
  statsQuerySchema,
  trainingCreateSchema,
} from "../src/index";

describe("schemas", () => {
  it("normalise les formations", () => {
    const parsed = trainingCreateSchema.parse({ reference: " sec-inc-01 ", title: " Sécurité incendie ", description: "" });
    expect(parsed).toEqual({
      reference: "SEC-INC-01",
      title: "Sécurité incendie",
      description: null,
      defaultDurationMinutes: null,
      active: true,
    });
    expect(trainingCreateSchema.safeParse({ reference: "x", title: "T" }).success).toBe(false);
  });

  it("normalise les participants (e-mail facultatif)", () => {
    expect(participantCreateSchema.parse({ firstName: "Jean", lastName: "Dupont", email: "" })).toMatchObject({
      email: null,
      employeeRef: null,
    });
    expect(participantCreateSchema.parse({ firstName: "Jean", lastName: "Dupont", email: " Jean@Example.CH " }).email).toBe(
      "jean@example.ch",
    );
    expect(participantCreateSchema.safeParse({ firstName: "Jean", lastName: "Dupont", email: "pas-un-mail" }).success).toBe(false);
    expect(participantCreateSchema.safeParse({ firstName: "", lastName: "Dupont" }).success).toBe(false);
  });

  it("convertit les horaires de session en UTC et vérifie l'ordre", () => {
    const parsed = sessionCreateSchema.parse({
      trainingId: "t1",
      startsAt: "2026-10-15T08:00:00+02:00",
      endsAt: "2026-10-15T10:00:00+02:00",
    });
    expect(parsed.startsAt).toBe("2026-10-15T06:00:00.000Z");
    expect(parsed.status).toBe("planned");
    expect(
      sessionCreateSchema.safeParse({ trainingId: "t1", startsAt: "2026-10-15T10:00:00Z", endsAt: "2026-10-15T08:00:00Z" }).success,
    ).toBe(false);
  });

  it("valide les périodes de statistiques", () => {
    expect(statsQuerySchema.safeParse({ from: "2026-09-01", to: "2026-09-30" }).success).toBe(true);
    expect(statsQuerySchema.safeParse({ from: "2026-09-30", to: "2026-09-01" }).success).toBe(false);
    expect(statsQuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(false);
    expect(statsQuerySchema.safeParse({ from: "2000-01-01", to: "2026-01-01" }).success).toBe(false);
  });

  it("discrimine les types de rapport", () => {
    expect(reportCreateSchema.parse({ type: "monthly", from: "2026-09-01", to: "2026-09-30" })).toMatchObject({ type: "monthly" });
    expect(reportCreateSchema.parse({ type: "session", sessionId: "s1" })).toEqual({ type: "session", sessionId: "s1" });
    expect(reportCreateSchema.safeParse({ type: "session" }).success).toBe(false);
    expect(reportCreateSchema.safeParse({ type: "hourly", from: "2026-09-01", to: "2026-09-30" }).success).toBe(false);
  });

  it("borne les payloads de scan et d'idempotence", () => {
    expect(scanResolveSchema.safeParse({ payload: "x".repeat(600) }).success).toBe(false);
    expect(attendanceValidateSchema.safeParse({ idempotencyKey: "short" }).success).toBe(false);
    expect(attendanceValidateSchema.parse({ idempotencyKey: "0192f2a0-aaaa" })).toMatchObject({ method: "qr", deviceId: null });
  });
});
