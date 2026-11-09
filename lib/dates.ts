export function isRealIsoDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseSourceDate(value: unknown): { iso: string | null; raw: string | null } {
  if (typeof value !== "string") return { iso: null, raw: null };
  const raw = value.trim();
  if (raw === "" || raw.toLowerCase() === "null" || raw.toLowerCase() === "n/a") {
    return { iso: null, raw: null };
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (us) {
    const iso = `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    return isRealIsoDate(iso) ? { iso, raw } : { iso: null, raw };
  }
  const grants = /^(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}$/.exec(raw);
  if (grants) {
    const iso = `${grants[1]}-${grants[2]}-${grants[3]}`;
    return isRealIsoDate(iso) ? { iso, raw } : { iso: null, raw };
  }
  const isoPrefix = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (isoPrefix && isRealIsoDate(isoPrefix[1])) return { iso: isoPrefix[1], raw };
  return { iso: null, raw };
}

export function formatIsoDate(value: string | null): string | null {
  if (!value || !isRealIsoDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatTimestamp(value: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(value) + " UTC"
  );
}

export function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addIsoDays(iso: string, days: number): string {
  if (!isRealIsoDate(iso)) throw new Error("bad date");
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatSamDay(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}/${day}/${date.getUTCFullYear()}`;
}
