import { DomainId, HydrationEntry, Volume, isErr } from '@fitness/domain';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';

export type HydrationEntryRow = Readonly<{
  description: string | null;
  fluid_type: string;
  id: string;
  local_calendar_date: string;
  occurred_at_epoch_ms: number;
  utc_offset_minutes: number;
  volume_milliliters: number;
}>;

export const hydrationEntryColumns = `id, fluid_type, volume_milliliters, description,
  occurred_at_epoch_ms, local_calendar_date, utc_offset_minutes`;

export function mapHydrationEntryRow(row: HydrationEntryRow): HydrationEntry {
  const id = DomainId.create(row.id);
  const volume = Volume.create(row.volume_milliliters, 'milliliter');
  if (isErr(id) || isErr(volume)) {
    throw new PersistenceError('operation-failed');
  }
  const entry = HydrationEntry.create({
    description: row.description,
    fluidType: row.fluid_type,
    id: id.value,
    localCalendarDate: row.local_calendar_date,
    occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
    utcOffsetMinutes: row.utc_offset_minutes,
    volume: volume.value,
  });
  if (isErr(entry)) throw new PersistenceError('operation-failed');
  return entry.value;
}
