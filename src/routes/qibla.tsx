import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LocateFixed, RefreshCw } from "lucide-react";
import { accuracyLabel, getFix, openAppSettings, headingSpread, type GeoError } from "@/lib/geo";
import { PageTitle } from "@/components/dhikr-list";
import { CITIES, coordsFor } from "@/lib/prayer";
import { usePrayerSettings } from "@/lib/use-prayer";
import { angleDiff, compassPoint, distanceToKaaba, magneticToTrue, qiblaBearing, smoothHeading } from "@/lib/qibla";
import { magneticDeclination } from "@/lib/declination";

export const Route = createFileRoute("/qibla")({
  head: () => ({
    meta: [
      { title: "Qibla direction — My Quran" },
      { name: "description", content: "Find the direction of the Kaaba from your phone's location or a chosen city, with a live compass." },
      { property: "og:title", content: "Qibla direction — My Quran" },
      { property: "og:description", content: "Accurate Qibla bearing from your location, works offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QiblaPage,
});

type OrientEvt = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type CompassPlugin = {
  isAvailable: () => Promise<{ available: boolean }>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addListener: (event: "heading", fn: (d: { heading: number; accuracy: number }) => void) => Promise<{ remove: () => Promise<void> }>;
};
type SensorState = "waiting" | "live" | "unavailable" | "needs-permission";

/** Live magnetic heading from the phone's compass (rotation-vector sensor via the WebView). */
function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [state, setState] = useState<SensorState>("waiting");
  const [active, setActive] = useState(false);
  const samples = useRef<number[]>([]);
  const last = useRef<number | null>(null);
  const [unstable, setUnstable] = useState(false);

  // Android app: read the phone's compass directly. WebViews often never send
  // absolute orientation events, which wrongly showed "No compass sensor found".
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    let handle: { remove: () => Promise<void> } | null = null;
    let compass: CompassPlugin | null = null;
    let fallback: number | undefined;
    void (async () => {
      const { Capacitor, registerPlugin } = await import("@capacitor/core");
      if (cancelled) return;
      // Ask the app's own compass directly; the plugin list check can miss app-registered plugins.
      if (Capacitor.getPlatform() !== "android") { setNative(false); return; }
      compass = registerPlugin<CompassPlugin>("Compass");
      try {
        const { available } = await compass.isAvailable();
        if (cancelled) return;
        // No magnetic sensor reported natively: still try the WebView's orientation events.
        if (!available) { setNative(false); return; }
        setNative(true);
        setState("waiting");
        // If the sensor never reports, fall back to the WebView's orientation events.
        fallback = window.setTimeout(() => { if (!cancelled && last.current == null) { void compass?.stop().catch(() => {}); setNative(false); } }, 4000);
        handle = await compass.addListener("heading", ({ heading: h, accuracy }) => {
          last.current = smoothHeading(last.current, h);
          setHeading(last.current);
          setState("live");
          samples.current = [...samples.current.slice(-19), h];
          if (samples.current.length >= 20) setUnstable(accuracy < 2 || headingSpread(samples.current) > 25);
        });
        await compass.start();
      } catch {
        if (!cancelled) { setNative(false); }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      void handle?.remove();
      void compass?.stop().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (native !== false) return;
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (!D) { setState("unavailable"); return; }
    if (D.requestPermission) setState("needs-permission");
    else setActive(true);
  }, [native]);

  useEffect(() => {
    if (!active) return;
    setState((s) => (s === "live" ? s : "waiting"));
    let gotAbsolute = false;
    const onEvt = (e: Event) => {
      const ev = e as OrientEvt;
      let h: number | null = null;
      if (typeof ev.webkitCompassHeading === "number" && ev.webkitCompassHeading >= 0) h = ev.webkitCompassHeading;
      else if (ev.absolute && ev.alpha != null) {
        if (e.type === "deviceorientationabsolute") gotAbsolute = true;
        else if (gotAbsolute) return; // prefer the dedicated absolute stream when both fire
        h = (360 - ev.alpha) % 360;
      }
      if (h == null) return;
      const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
      h = (h + angle + 360) % 360;
      last.current = smoothHeading(last.current, h);
      setHeading(last.current);
      setState("live");
      samples.current = [...samples.current.slice(-19), h];
      if (samples.current.length >= 20) setUnstable(headingSpread(samples.current) > 25);
    };
    window.addEventListener("deviceorientationabsolute", onEvt);
    window.addEventListener("deviceorientation", onEvt);
    const t = window.setTimeout(() => { if (last.current == null) setState("unavailable"); }, 2500);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("deviceorientationabsolute", onEvt);
      window.removeEventListener("deviceorientation", onEvt);
    };
  }, [active]);

  const request = async () => {
    const D = (window as unknown as { DeviceOrientationEvent: { requestPermission: () => Promise<string> } }).DeviceOrientationEvent;
    try {
      if ((await D.requestPermission()) === "granted") setActive(true);
      else setState("unavailable");
    } catch { setState("unavailable"); }
  };
  return { heading, state, request, unstable };
}

/** Keeps a rotation continuous (no 359→0 spin) for CSS transitions. */
function useUnwrapped(target: number) {
  const ref = useRef(target);
  ref.current = ref.current + angleDiff(ref.current, target);
  return ref.current;
}

function Dial({ rotation, bearing, aligned, live }: { rotation: number; bearing: number; aligned: boolean; live: boolean }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <div className="qibla-dial relative mx-auto aspect-square w-[min(78vw,20rem)]" data-aligned={aligned}>
      <div className="qibla-halo absolute inset-0 rounded-full" aria-hidden />
      <svg viewBox="0 0 200 200" className="qibla-rotor absolute inset-0 h-full w-full" style={{ transform: `rotate(${rotation}deg)` }} aria-hidden>
        <circle cx="100" cy="100" r="96" className="fill-card stroke-border" strokeWidth="1" />
        <circle cx="100" cy="100" r="74" className="fill-none stroke-border" strokeWidth="0.6" />
        {ticks.map((d) => {
          const major = d % 30 === 0;
          return <line key={d} x1="100" y1="6" x2="100" y2={major ? 15 : 11} transform={`rotate(${d} 100 100)`} className={major ? "stroke-foreground/60" : "stroke-muted-foreground/40"} strokeWidth={major ? 1.4 : 0.8} strokeLinecap="round" />;
        })}
        {[30, 60, 120, 150, 210, 240, 300, 330].map((d) => (
          <text key={d} x="100" y="25" transform={`rotate(${d} 100 100)`} textAnchor="middle" className="fill-muted-foreground text-[6.5px] tabular-nums">{d}</text>
        ))}
        {(["N", "E", "S", "W"] as const).map((p, i) => (
          <text key={p} x="100" y="31" transform={`rotate(${i * 90} 100 100)`} textAnchor="middle" className={`font-display text-[13px] ${p === "N" ? "fill-destructive" : "fill-foreground"}`}>{p}</text>
        ))}
        {/* Qibla needle */}
        <g transform={`rotate(${bearing} 100 100)`}>
          <path d="M100 52 L106 100 L100 108 L94 100 Z" className="fill-gold" />
          <path d="M100 52 L100 108 L94 100 Z" className="fill-gold opacity-70" />
          <g transform="translate(100 50)">
            <rect x="-7" y="-15" width="14" height="14" rx="1.5" className="fill-foreground" />
            <rect x="-7" y="-11.5" width="14" height="2" className="fill-gold" />
          </g>
          <path d="M100 162 L104 100 L96 100 Z" className="fill-muted-foreground/30" />
        </g>
        <circle cx="100" cy="100" r="5" className="fill-primary" />
        <circle cx="100" cy="100" r="2" className="fill-card" />
      </svg>
      {/* Fixed lubber line: the direction the top of the phone points */}
      <span className={`qibla-lubber absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1 ${live ? "" : "opacity-40"}`} aria-hidden />
    </div>
  );
}

const GEO_MSG: Record<GeoError, string> = {
  denied: "Location permission was declined. Tap Use my location to ask again, or pick a city instead.",
  blocked: "Location is turned off for this app. Open Settings → Permissions → Location and choose Allow, then come back.",
  unavailable: "Couldn't get a location. Check that Location is turned on, then try again.",
  timeout: "Finding your location took too long. Move near a window or outdoors and try again.",
  unsupported: "This device can't share its location. Pick a city instead.",
};

function QiblaPage() {
  const [settings, setSettings] = usePrayerSettings();
  const { lat, lng } = coordsFor(settings);
  const usingDevice = settings.city === "custom" && !!settings.custom;
  const cityName = CITIES.find((c) => c.id === settings.city)?.name ?? CITIES[0]!.name;
  const acc = settings.custom?.accuracy;
  const bearing = qiblaBearing(lat, lng);
  const km = distanceToKaaba(lat, lng);
  const decl = magneticDeclination(lat, lng);
  const { heading: magHeading, state, request, unstable } = useHeading();
  const heading = magHeading == null ? null : magneticToTrue(magHeading, decl ?? 0);
  const [geo, setGeo] = useState<"idle" | "explain" | "busy" | GeoError>("idle");

  const locate = async () => {
    setGeo("busy");
    try {
      const f = await getFix();
      setSettings((x) => ({ ...x, city: "custom", custom: { lat: f.lat, lng: f.lng, accuracy: f.accuracy, at: f.at } }));
      setGeo("idle");
    } catch (e) { setGeo(e as GeoError); }
  };

  const live = heading != null;
  const rotation = useUnwrapped(live ? -heading : 0);
  const offBy = live ? angleDiff(heading, bearing) : null;
  const aligned = offBy != null && Math.abs(offBy) <= 3;
  const accText = acc != null ? ` · ±${acc < 1000 ? `${Math.round(acc)} m` : `${(acc / 1000).toFixed(1)} km`}` : "";
  const sourceText = usingDevice
    ? `GPS location${accText}${acc != null && accuracyLabel(acc) !== "precise" ? " (approximate)" : ""}`
    : `${cityName} · chosen city, not GPS`;

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 pb-10">
      <PageTitle title="Qibla" sub={sourceText} />

      <Dial rotation={rotation} bearing={bearing} aligned={aligned} live={live} />

      <p className={`mt-5 text-center font-medium transition-colors ${aligned ? "text-primary" : "text-foreground"}`} aria-live="polite">
        {state === "needs-permission" ? "Allow compass access to see live direction."
          : state === "waiting" ? "Starting compass…"
          : !live ? "No compass sensor found. Face the bearing below using a separate compass."
          : aligned ? "You are facing the Qibla"
          : `Turn ${offBy! > 0 ? "right" : "left"} ${Math.abs(Math.round(offBy!))}°`}
      </p>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-border text-center">
        <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Heading</dt><dd className="font-display text-2xl tabular-nums text-foreground">{live ? `${Math.round(heading) % 360}°` : "—"}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Qibla</dt><dd className="font-display text-2xl tabular-nums text-gold">{Math.round(bearing)}° <span className="text-sm text-muted-foreground">{compassPoint(bearing)}</span></dd></div>
        <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Difference</dt><dd className="font-display text-2xl tabular-nums text-foreground">{offBy == null ? "—" : `${Math.abs(Math.round(offBy))}°`}</dd></div>
      </dl>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        True north{decl != null ? ` · magnetic declination ${Math.abs(decl).toFixed(1)}° ${decl >= 0 ? "E" : "W"} corrected` : ""} · {Math.round(km).toLocaleString()} km to the Kaaba
      </p>

      {live && unstable && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">Readings are jumping. Move the phone in a figure-8 a few times, and keep it flat and away from metal, magnets and cases with magnets.</p>
      )}
      {state === "needs-permission" && (
        <button onClick={request} className="mx-auto mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Use phone compass</button>
      )}

      <section className="surface-card mt-6 p-4">
        {geo === "explain" ? (
          <>
            <p className="text-sm text-foreground">Your location is used only on this phone to work out the exact Qibla bearing and your prayer times. It is never sent anywhere.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setGeo("idle")} className="min-h-11 rounded-md border border-input text-sm text-foreground">Not now</button>
              <button onClick={locate} className="min-h-11 rounded-md bg-primary text-sm font-medium text-primary-foreground">Continue</button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => (usingDevice ? locate() : setGeo("explain"))}
              disabled={geo === "busy"}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
            >
              {usingDevice ? <RefreshCw size={16} className={geo === "busy" ? "animate-spin" : ""} /> : <LocateFixed size={16} />}
              {geo === "busy" ? "Finding your location…" : usingDevice ? "Update my location" : "Use my location"}
            </button>
            {geo !== "idle" && geo !== "busy" && <p className="mt-2 text-sm text-destructive" role="alert">{GEO_MSG[geo]}</p>}
            {geo === "blocked" && (
              <button onClick={() => void openAppSettings()} className="mt-2 min-h-11 w-full rounded-md border border-input text-sm font-medium text-foreground">Open Android Settings</button>
            )}
            <label className="mt-3 block text-xs text-muted-foreground">
              Or choose a city
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={settings.city}
                onChange={(e) => setSettings((x) => ({ ...x, city: e.target.value }))}
              >
                {settings.custom && <option value="custom">My GPS location</option>}
                {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <p className="mt-3 text-xs text-muted-foreground">The same location is used for <Link to="/ramadan" className="text-primary underline">prayer times</Link>. Works offline once set.</p>
          </>
        )}
      </section>
    </main>
  );
}
