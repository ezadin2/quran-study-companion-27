import { describe, it, expect } from "vitest";
import { angleDiff, magneticToTrue, smoothHeading } from "@/lib/qibla";
import { magneticDeclination } from "@/lib/declination";

describe("qibla compass maths", () => {
  it("turn direction uses the shortest arc across north", () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(-20);
  });
  it("smoothing does not spin the long way round at 359→0", () => {
    const h = smoothHeading(359, 1, 0.5);
    expect(h === 0 || h > 359 || h < 1).toBe(true);
  });
  it("magnetic heading converts to true north with declination", () => {
    expect(magneticToTrue(350, 12)).toBe(2);
    expect(magneticToTrue(5, -12)).toBe(353);
  });
  it("New York declination is about 12–13° west", () => {
    const d = magneticDeclination(40.7, -74, new Date("2026-06-01"))!;
    expect(d).toBeLessThan(-11);
    expect(d).toBeGreaterThan(-14);
  });
});
