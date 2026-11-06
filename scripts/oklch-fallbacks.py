"""Regenerate the old-Android colour fallback block at the end of src/styles.css.
Android WebViews before Chromium 111 drop oklch() values, which makes every
background (menus, dialogs, drawers) transparent. Run after changing tokens."""
import math, re, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / "src/styles.css"
css = p.read_text()
START, END = "/* oklch-fallbacks:start */", "/* oklch-fallbacks:end */"
css = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", css, flags=re.S)

def conv(m):
    L, C, H = m.group(1), float(m.group(2)), float(m.group(3) or 0)
    L = float(L[:-1]) / 100 if L.endswith('%') else float(L)
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l_ = (L + 0.3963377774*a + 0.2158037573*b) ** 3
    m_ = (L - 0.1055613458*a - 0.0638541728*b) ** 3
    s_ = (L - 0.0894841775*a - 1.2914855480*b) ** 3
    rgb = [4.0767416621*l_ - 3.3077115913*m_ + 0.2309699292*s_,
           -1.2684380046*l_ + 2.6097574011*m_ - 0.3413193965*s_,
           -0.0041960863*l_ - 0.7034186147*m_ + 1.7076147010*s_]
    def g(x):
        x = max(0.0, min(1.0, x))
        return round(255 * (12.92*x if x <= 0.0031308 else 1.055*x**(1/2.4) - 0.055))
    r, gg, bb = (g(x) for x in rgb)
    al = m.group(4)
    if al:
        al = float(al[:-1]) / 100 if al.endswith('%') else float(al)
        return f"rgba({r}, {gg}, {bb}, {al:g})"
    return f"rgb({r}, {gg}, {bb})"

pat = re.compile(r"oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)?\s*(?:/\s*([\d.]+%?))?\s*\)")
out = []
for blk in re.finditer(r"^((?::root|\.dark)[^{\n]*)\{(.*?)^\}", css, flags=re.S | re.M):
    decls = [f"    {n}: {pat.sub(conv, v.strip())};" for n, v in re.findall(r"(--[\w-]+)\s*:\s*([^;]*oklch[^;]*);", blk.group(2))]
    if decls:
        out.append(f"  {blk.group(1).strip()} {{\n" + "\n".join(decls) + "\n  }")
block = f"{START}\n@supports not (color: oklch(0 0 0)) {{\n" + "\n".join(out) + "\n}\n" + END + "\n"
p.write_text(css.rstrip("\n") + "\n\n" + block)
print(len(out), "blocks")
