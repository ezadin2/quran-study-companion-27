// Qibla direction computed fully offline from saved coordinates (no GPS needed).
export const KAABA = { lat: 21.4225, lng: 39.8262 };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Initial great-circle bearing from the point to the Kaaba, degrees clockwise from true north (0–360). */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = rad(lat), φ2 = rad(KAABA.lat), Δλ = rad(KAABA.lng - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle distance to the Kaaba in kilometres. */
export function distanceToKaaba(lat: number, lng: number): number {
  const φ1 = rad(lat), φ2 = rad(KAABA.lat);
  const a = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(rad(KAABA.lng - lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function compassPoint(bearing: number): string {
  const pts = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return pts[Math.round(bearing / 45) % 8]!;
}

/** Shortest signed angle from `from` to `to`, in degrees (-180..180]. Positive = turn right. */
export function angleDiff(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** Circular low-pass: move `prev` toward `next` by factor `k` along the shortest arc (handles 359→0). */
export function smoothHeading(prev: number | null, next: number, k = 0.35): number {
  if (prev == null) return ((next % 360) + 360) % 360;
  return (((prev + angleDiff(prev, next) * k) % 360) + 360) % 360;
}

/** Convert a magnetic-north heading to true north using magnetic declination (east positive). */
export function magneticToTrue(magnetic: number, declination: number): number {
  return (((magnetic + declination) % 360) + 360) % 360;
}
