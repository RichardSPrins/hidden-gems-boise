/**
 * Operating-hours helpers shared by the portal location create/edit endpoints.
 * Hours are stored one row per day (0 = Sunday … 6 = Saturday), unique per
 * (locationId, dayOfWeek). We model edits as a full replace of the 7-day set.
 */
import { db } from "@/lib/db";
import { operatingHours } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface DayHours {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return TIME_RE.test(t) ? t : null;
}

/**
 * Coerce arbitrary input into a clean 0–6 hours array, or null when no hours
 * were supplied (so callers can leave existing hours untouched).
 */
export function normalizeHours(input: unknown): DayHours[] | null {
  if (!Array.isArray(input)) return null;
  const byDay = new Map<number, DayHours>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const day = Number(r.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    const isClosed = Boolean(r.isClosed);
    byDay.set(day, {
      dayOfWeek: day,
      isClosed,
      openTime: isClosed ? null : cleanTime(r.openTime),
      closeTime: isClosed ? null : cleanTime(r.closeTime),
    });
  }
  return [...byDay.values()];
}

/** Replace all hours rows for a location with the supplied set. */
export async function replaceHours(
  locationId: string,
  hours: DayHours[],
): Promise<void> {
  await db
    .delete(operatingHours)
    .where(eq(operatingHours.locationId, locationId));
  if (hours.length > 0) {
    await db
      .insert(operatingHours)
      .values(hours.map((h) => ({ locationId, ...h })));
  }
}
