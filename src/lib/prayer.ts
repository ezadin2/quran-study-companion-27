import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";

export type PrayerName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
export const PRAYERS: PrayerName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export type City = { id: string; name: string; lat: number; lng: number; tz: string };
export const CITIES: City[] = [
  { id: "addis", name: "Addis Ababa", lat: 9.03, lng: 38.74, tz: "Africa/Addis_Ababa" },
  { id: "adama", name: "Adama", lat: 8.54, lng: 39.27, tz: "Africa/Addis_Ababa" },
  { id: "jimma", name: "Jimma", lat: 7.67, lng: 36.83, tz: "Africa/Addis_Ababa" },
  { id: "harar", name: "Harar", lat: 9.31, lng: 42.12, tz: "Africa/Addis_Ababa" },
  { id: "diredawa", name: "Dire Dawa", lat: 9.6, lng: 41.85, tz: "Africa/Addis_Ababa" },
  { id: "bahirdar", name: "Bahir Dar", lat: 11.59, lng: 37.39, tz: "Africa/Addis_Ababa" },
  { id: "dessie", name: "Dessie", lat: 11.13, lng: 39.63, tz: "Africa/Addis_Ababa" },
  { id: "hawassa", name: "Hawassa", lat: 7.06, lng: 38.48, tz: "Africa/Addis_Ababa" },
  { id: "nairobi", name: "Nairobi", lat: -1.29, lng: 36.82, tz: "Africa/Nairobi" },
  { id: "mecca", name: "Makkah", lat: 21.42, lng: 39.83, tz: "Asia/Riyadh" },
  { id: "medina", name: "Madinah", lat: 24.47, lng: 39.61, tz: "Asia/Riyadh" },
  { id: "riyadh", name: "Riyadh", lat: 24.71, lng: 46.68, tz: "Asia/Riyadh" },
  { id: "dubai", name: "Dubai", lat: 25.2, lng: 55.27, tz: "Asia/Dubai" },
  { id: "cairo", name: "Cairo", lat: 30.04, lng: 31.24, tz: "Africa/Cairo" },
  { id: "istanbul", name: "Istanbul", lat: 41.01, lng: 28.98, tz: "Europe/Istanbul" },
  { id: "london", name: "London", lat: 51.51, lng: -0.13, tz: "Europe/London" },
  { id: "washington", name: "Washington, DC", lat: 38.9, lng: -77.04, tz: "America/New_York" },
  { id: "minneapolis", name: "Minneapolis", lat: 44.98, lng: -93.27, tz: "America/Chicago" },
];

export const METHODS = {
  mwl: { label: "Muslim World League", make: () => CalculationMethod.MuslimWorldLeague() },
  egypt: { label: "Egyptian General Authority", make: () => CalculationMethod.Egyptian() },
  makkah: { label: "Umm al-Qura, Makkah", make: () => CalculationMethod.UmmAlQura() },
  karachi: { label: "University of Islamic Sciences, Karachi", make: () => CalculationMethod.Karachi() },
  isna: { label: "ISNA (North America)", make: () => CalculationMethod.NorthAmerica() },
} as const;
export type MethodId = keyof typeof METHODS;

export type PrayerSettings = { city: string; custom?: { lat: number; lng: number; accuracy?: number; at?: number }; method: MethodId; hanafi: boolean; hijriOffset: number };
export const DEFAULT_SETTINGS: PrayerSettings = { city: "addis", method: "mwl", hanafi: false, hijriOffset: 0 };
export const SETTINGS_KEY = "prayer-settings-v1";

export function coordsFor(s: PrayerSettings) {
  if (s.city === "custom" && s.custom) return s.custom;
  const c = CITIES.find((x) => x.id === s.city) ?? CITIES[0]!;
  return { lat: c.lat, lng: c.lng };
}

/** IANA time zone of the selected city; custom GPS locations use the device zone. */
export function tzFor(s: PrayerSettings): string | undefined {
  if (s.city === "custom") return undefined;
  return (CITIES.find((x) => x.id === s.city) ?? CITIES[0]!).tz;
}

/** A Date whose local Y/M/D is the calendar day at `at` in time zone `tz` (adhan reads local Y/M/D). */
export function cityDay(at: Date, tz?: string): Date {
  if (!tz) return new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

/** Prayer times for the city's calendar day containing instant `date`. */
export function timesFor(s: PrayerSettings, date = new Date()): Record<PrayerName, Date> {
  return timesForDay(s, cityDay(date, tzFor(s)));
}

function timesForDay(s: PrayerSettings, date: Date): Record<PrayerName, Date> {
  const { lat, lng } = coordsFor(s);
  const params = METHODS[s.method].make();
  params.madhab = s.hanafi ? Madhab.Hanafi : Madhab.Shafi;
  const p = new PrayerTimes(new Coordinates(lat, lng), date, params);
  return { fajr: p.fajr, sunrise: p.sunrise, dhuhr: p.dhuhr, asr: p.asr, maghrib: p.maghrib, isha: p.isha };
}

/** Next obligatory prayer (sunrise excluded) after `now`, rolling over to tomorrow's Fajr. */
export function nextPrayer(s: PrayerSettings, now = new Date()): { name: PrayerName; at: Date } {
  const day = cityDay(now, tzFor(s));
  const today = timesForDay(s, day);
  for (const n of ["fajr", "dhuhr", "asr", "maghrib", "isha"] as PrayerName[]) if (today[n] > now) return { name: n, at: today[n] };
  const tomorrow = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return { name: "fajr", at: timesForDay(s, tomorrow).fajr };
}

/** Clock time shown in the selected city's own time zone. */
export function formatTime(d: Date, s?: PrayerSettings) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: s ? tzFor(s) : undefined });
}

export function formatDuration(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah"];

/** Hijri date via the device's Umm al-Qura calendar, shifted by a user offset in days. */
export function hijri(date = new Date(), offset = 0) {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/\D/g, ""));
  const day = get("day");
  const month = get("month");
  const year = get("year");
  return { day, month, year, monthName: HIJRI_MONTHS[month - 1] ?? "", label: `${day} ${HIJRI_MONTHS[month - 1] ?? ""} ${year} AH` };
}

/** Days until 1 Ramadan (0 when currently in Ramadan). */
export function daysUntilRamadan(date = new Date(), offset = 0) {
  for (let i = 0; i < 400; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    const h = hijri(d, offset);
    if (h.month === 9) return i;
  }
  return -1;
}
