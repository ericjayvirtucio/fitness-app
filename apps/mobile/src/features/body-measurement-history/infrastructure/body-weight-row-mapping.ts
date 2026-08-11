import { BodyWeightEntry, DomainId, Mass, isErr } from '@fitness/domain';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';

export type BodyWeightEntryRow = Readonly<{
  id: string;
  local_calendar_date: string;
  mass_grams: number;
  note: string | null;
  occurred_at_epoch_ms: number;
  utc_offset_minutes: number;
}>;

export const bodyWeightEntryColumns = `id, mass_grams, note, occurred_at_epoch_ms,
  local_calendar_date, utc_offset_minutes`;

export function mapBodyWeightEntryRow(
  row: BodyWeightEntryRow,
): BodyWeightEntry {
  const id = DomainId.create(row.id);
  const mass = Mass.create(row.mass_grams, 'gram');
  if (isErr(id) || isErr(mass)) throw new PersistenceError('operation-failed');
  const entry = BodyWeightEntry.create({
    id: id.value,
    localCalendarDate: row.local_calendar_date,
    mass: mass.value,
    note: row.note,
    occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
    utcOffsetMinutes: row.utc_offset_minutes,
  });
  if (isErr(entry)) throw new PersistenceError('operation-failed');
  return entry.value;
}
