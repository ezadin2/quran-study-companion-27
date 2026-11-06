import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LANGUAGES, type Lang } from "@/lib/quran";
import { useLang } from "@/lib/lang";
import { MoreDrawer } from "@/components/more-drawer";

export function SiteHeader() {
  const { lang, setLang, t } = useLang();
  const router = useRouter();
  const path = useLocation({ select: (l) => l.pathname });
  // Tab-bar destinations are roots; every other page gets an Android-style back arrow.
  const isRoot = ["/", "/quran", "/azkar", "/ramadan", "/more"].includes(path.replace(/\/$/, "") || "/");
  const goBack = () => { if (window.history.length > 1) router.history.back(); else void router.navigate({ to: "/" }); };
  return (
    <header className="app-header sticky z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="app-header-inner mx-auto flex max-w-6xl items-center justify-between gap-2 py-2.5 sm:gap-4">
        <div className="flex min-w-0 items-center gap-1">
        {!isRoot && (
          <button type="button" onClick={goBack} aria-label="Back" className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary">
            <ArrowLeft size={22} />
          </button>
        )}
        <Link to="/" className="group flex min-h-11 min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary shadow-sm ring-1 ring-gold/40 transition-transform group-hover:scale-105"><img src="/logo.png" alt="" className="h-6 w-6" /></span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-display text-[1.35rem] font-semibold tracking-tight text-primary">{t("appName")}</span>
            <span className="mt-1 hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">Quran · Azkar · Prayer</span>
          </span>
        </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {/* Phones use the bottom tab bar; text links only appear on wider screens. */}
          {([["/quran", "navQuran"], ["/azkar", "navAzkar"], ["/ramadan", "navPrayer"], ["/hadith", "navHadith"]] as const).map(([to, key]) => (
            <Link key={to} to={to} className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary text-primary font-semibold" }}>{t(key)}</Link>
          ))}
        </nav>
        <select
          aria-label={t("language")}
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="hidden min-h-10 min-w-0 max-w-32 rounded-full border border-input bg-card px-3 py-1.5 text-sm text-foreground sm:block"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <MoreDrawer />
        </div>
      </div>
    </header>
  );
}
