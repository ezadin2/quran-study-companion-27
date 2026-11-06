import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, formatTime, nextPrayer } from "./prayer";

// Addis Ababa is UTC+3 all year. These must hold whatever the device time zone is.
describe("Addis Ababa prayer times", () => {
  const s = DEFAULT_SETTINGS; // city: addis

  it("after Fajr in Addis (07:03 local), next prayer is Dhuhr, not a past Fajr", () => {
    const now = new Date("2026-11-03T04:03:00Z"); // 07:03 in Addis
    const next = nextPrayer(s, now);
    expect(next.name).toBe("dhuhr");
    expect(next.at.getTime()).toBeGreaterThan(now.getTime());
  });

  it("late evening in Addis rolls over to tomorrow's Fajr in the future", () => {
    const now = new Date("2026-11-03T20:30:00Z"); // 23:30 in Addis
    const next = nextPrayer(s, now);
    expect(next.name).toBe("fajr");
    expect(next.at.getTime()).toBeGreaterThan(now.getTime());
    expect(next.at.getTime() - now.getTime()).toBeLessThan(12 * 3600e3);
  });

  it("shows times on the Addis clock (Fajr before 6 AM)", () => {
    const next = nextPrayer(s, new Date("2026-11-03T20:30:00Z"));
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Addis_Ababa" }).format(next.at),
    );
    expect(hour).toBeLessThan(6);
    expect(formatTime(next.at, s)).toMatch(/^[45]:/);
  });
});
