/** All internal lengths are millimetres. These helpers convert for display/entry only. */

export const MM_PER_INCH = 25.4;

export type DisplayUnit = "mm" | "in";

export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inToMm(inch: number): number {
  return inch * MM_PER_INCH;
}

/** Format a millimetre value for the given display unit. */
export function formatLength(mm: number, unit: DisplayUnit, digits?: number): string {
  if (unit === "in") {
    const d = digits ?? 2;
    return `${mmToIn(mm).toFixed(d)}"`;
  }
  const d = digits ?? 1;
  return `${mm.toFixed(d)} mm`;
}

/** Parse a user-entered length string in the given unit back to millimetres. Returns null if unparseable. */
export function parseLength(raw: string, unit: DisplayUnit): number | null {
  const cleaned = raw.trim().replace(/["']$/, "").replace(/mm$/i, "").replace(/in$/i, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return unit === "in" ? inToMm(value) : value;
}

export function round(value: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
