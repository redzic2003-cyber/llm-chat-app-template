import { describe, expect, it } from "vitest";
import {
  addDays,
  eachMonth,
  eachWeek,
  isValidDateKey,
  isoWeekKey,
  localDateKey,
  localTime,
  periodLabel,
  periodToUtcRange,
  presetPeriod,
  timeZoneOffsetMinutes,
  zonedToUtc,
} from "../src/time";

const TZ = "Europe/Zurich";

describe("fuseaux horaires", () => {
  it("convertit l'heure locale suisse en UTC (été et hiver)", () => {
    expect(zonedToUtc("2026-10-15", "08:00", TZ).toISOString()).toBe("2026-10-15T06:00:00.000Z");
    expect(zonedToUtc("2026-12-15", "08:00", TZ).toISOString()).toBe("2026-12-15T07:00:00.000Z");
  });

  it("gère les jours de changement d'heure", () => {
    // Passage à l'heure d'hiver le 25.10.2026 à 03:00 → 02:00.
    expect(zonedToUtc("2026-10-25", "00:00", TZ).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(zonedToUtc("2026-10-26", "00:00", TZ).toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(timeZoneOffsetMinutes("2026-03-29T00:30:00Z", TZ)).toBe(60);
    expect(timeZoneOffsetMinutes("2026-03-29T01:30:00Z", TZ)).toBe(120);
  });

  it("donne la date locale d'un instant UTC", () => {
    expect(localDateKey("2026-10-14T22:30:00Z", TZ)).toBe("2026-10-15");
    expect(localDateKey("2026-10-14T22:30:00Z", "UTC")).toBe("2026-10-14");
    expect(localTime("2026-10-15T06:00:00Z", TZ)).toBe("08:00");
  });

  it("calcule les bornes UTC d'une période locale", () => {
    const range = periodToUtcRange({ from: "2026-09-01", to: "2026-09-30" }, TZ);
    expect(range.start.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });
});

describe("calendrier", () => {
  it("valide les dates", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2026-9-1")).toBe(false);
  });

  it("calcule les semaines ISO, y compris en bord d'année", () => {
    expect(isoWeekKey("2026-10-01")).toBe("2026-W40");
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekKey("2024-12-30")).toBe("2025-W01");
  });

  it("énumère semaines et mois", () => {
    expect(eachWeek("2026-09-28", "2026-10-11")).toEqual(["2026-W40", "2026-W41"]);
    expect(eachMonth("2026-01-15", "2026-03-02")).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("calcule les périodes prédéfinies", () => {
    const today = "2026-10-01"; // jeudi
    expect(presetPeriod("7d", today)).toEqual({ from: "2026-09-25", to: "2026-10-01" });
    expect(presetPeriod("week", today)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(presetPeriod("month", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetPeriod("last-month", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetPeriod("quarter", today)).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(presetPeriod("year", today)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("produit des libellés de période", () => {
    expect(periodLabel("monthly", { from: "2026-09-01", to: "2026-09-30" })).toBe("Septembre 2026");
    expect(periodLabel("weekly", { from: "2026-09-28", to: "2026-10-04" })).toBe("Semaine 40 · 2026");
    expect(periodLabel("yearly", { from: "2026-01-01", to: "2026-12-31" })).toBe("Année 2026");
    expect(periodLabel("custom", { from: "2026-09-01", to: "2026-09-15" })).toBe("01.09.2026 – 15.09.2026");
  });
});
