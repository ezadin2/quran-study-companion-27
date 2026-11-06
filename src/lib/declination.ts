// Magnetic declination from the bundled World Magnetic Model (WMM 2025), fully offline.
import geomagnetism from "geomagnetism";

/** Declination in degrees (east positive) for a point on a date; null if the model can't evaluate it. */
export function magneticDeclination(lat: number, lng: number, date = new Date()): number | null {
  try {
    const d = geomagnetism.model(date, { allowOutOfBoundsModel: true }).point([lat, lng]).decl;
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}
