// Older Android WebViews (Chromium < 100) lack some newer built-ins used by the
// app and its libraries (pop-ups, menus, drawers). Patch them before anything loads.
/* eslint-disable @typescript-eslint/no-explicit-any */
const O = Object as any;
if (!O.hasOwn) {
  O.hasOwn = (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key);
}
const S = String.prototype as any;
if (!S.replaceAll) {
  S.replaceAll = function (this: string, search: string | RegExp, replacement: any) {
    if (search instanceof RegExp) return this.replace(search, replacement);
    return this.split(search).join(typeof replacement === "function" ? replacement(search) : replacement);
  };
}
function at(this: any, n: number) {
  n = Math.trunc(n) || 0;
  if (n < 0) n += this.length;
  return n < 0 || n >= this.length ? undefined : this[n];
}
for (const C of [Array, String, Int8Array, Uint8Array, Float32Array] as any[]) {
  if (!C.prototype.at) Object.defineProperty(C.prototype, "at", { value: at, writable: true, configurable: true });
}
const A = Array.prototype as any;
if (!A.findLast) {
  A.findLast = function (this: any[], fn: any, t?: any) {
    for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return this[i];
    return undefined;
  };
  A.findLastIndex = function (this: any[], fn: any, t?: any) {
    for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return i;
    return -1;
  };
}
if (typeof (globalThis as any).structuredClone !== "function") {
  (globalThis as any).structuredClone = (v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
}
if (typeof crypto !== "undefined" && !(crypto as any).randomUUID) {
  (crypto as any).randomUUID = () =>
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
    );
}
export {};
