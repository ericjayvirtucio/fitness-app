import { Length, Mass, type UnitSystem } from '@fitness/domain';
import {
  canonicalUnitFor,
  personalRecordDescriptor,
  type ExercisePersonalRecord,
  type PersonalRecordUnit,
} from '../application/exercise-personal-records';
import { formatDuration } from '../../workout-session/presentation/workout-result-formatting';

/**
 * Display formatting for derived history. Canonical values drive every
 * comparison; the preferred unit system only changes how a stored number is
 * written, and rounding happens here rather than anywhere a record is selected.
 */

export function formatCapturedDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1),
  ).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

export function formatRecordedMass(
  grams: number,
  unitSystem: UnitSystem,
): string {
  return `${formatNumber(massIn(grams, unitSystem))} ${unitSystem === 'metric' ? 'kg' : 'lb'}`;
}

export function formatRecordedDistance(
  millimeters: number,
  unitSystem: UnitSystem,
): string {
  return `${formatNumber(distanceIn(millimeters, unitSystem))} ${unitSystem === 'metric' ? 'km' : 'mi'}`;
}

export function formatRecordedLoadVolume(
  gramRepetitions: number,
  unitSystem: UnitSystem,
): string {
  return `${formatNumber(massIn(gramRepetitions, unitSystem))} ${unitSystem === 'metric' ? 'kg-reps' : 'lb-reps'}`;
}

/**
 * Recorded load volume sums external load and added bodyweight load and nothing
 * else, so the sentence carrying it states what it covers rather than leaving a
 * reader to remember how each exercise was configured.
 *
 * The qualifier is unconditional because it is true whether or not the period
 * also holds assisted, bodyweight, duration, or distance work. Saying "this does
 * not count your assisted sets" would be truthful only when such sets exist, and
 * knowing that would need something the reader does not report. It states no
 * reason, names no excluded mode, and compares nothing. See ADR 0023.
 */
export function formatRecordedLoadVolumeSummary(
  gramRepetitions: number,
  unitSystem: UnitSystem,
): string {
  return `${formatRecordedLoadVolume(gramRepetitions, unitSystem)} recorded load volume from weighted sets`;
}

/**
 * The same sentence with the number removed, for a period that recorded work but
 * none that contributes. It is deliberately not `0 kg-reps`: an absent dimension
 * has never been rendered as zero, and zero would be a false claim about the
 * work that was recorded.
 */
export const absentRecordedLoadVolumeMessage =
  'No recorded load volume from weighted sets';

export function formatPersonalRecordValue(
  record: ExercisePersonalRecord,
  unitSystem: UnitSystem,
): string {
  const unit = unitFor(record);
  if (unit === 'repetitions') return `${record.canonicalValue} reps`;
  if (unit === 'grams')
    return formatRecordedMass(record.canonicalValue, unitSystem);
  if (unit === 'seconds') return formatDuration(record.canonicalValue);
  return formatRecordedDistance(record.canonicalValue, unitSystem);
}

/**
 * The same value with every unit written out, because an accessible label is
 * read aloud and "kg" is not a word.
 */
export function formatPersonalRecordSpokenValue(
  record: ExercisePersonalRecord,
  unitSystem: UnitSystem,
): string {
  const unit = unitFor(record);
  if (unit === 'repetitions')
    return `${record.canonicalValue} ${record.canonicalValue === 1 ? 'repetition' : 'repetitions'}`;
  if (unit === 'grams')
    return `${formatNumber(massIn(record.canonicalValue, unitSystem))} ${unitSystem === 'metric' ? 'kilograms' : 'pounds'}`;
  if (unit === 'seconds') return formatSpokenDuration(record.canonicalValue);
  return `${formatNumber(distanceIn(record.canonicalValue, unitSystem))} ${unitSystem === 'metric' ? 'kilometers' : 'miles'}`;
}

export function describePersonalRecord(
  record: ExercisePersonalRecord,
  unitSystem: UnitSystem,
  showsCapturedName: boolean,
): string {
  const parts = [
    personalRecordDescriptor(record.category).label,
    formatPersonalRecordSpokenValue(record, unitSystem),
    `first recorded on ${formatCapturedDate(record.occurrence.startedLocalCalendarDate)}`,
    `in ${record.occurrence.sessionNameSnapshot}`,
    `set ${record.occurrence.setPosition + 1}`,
  ];
  if (showsCapturedName)
    parts.push(`recorded as ${record.occurrence.exerciseNameSnapshot}`);
  return parts.join(', ');
}

function unitFor(record: ExercisePersonalRecord): PersonalRecordUnit {
  return canonicalUnitFor(personalRecordDescriptor(record.category).dimension);
}

function massIn(grams: number, unitSystem: UnitSystem): number {
  const mass = Mass.create(grams, 'gram');
  return mass.isSuccess
    ? mass.value.in(unitSystem === 'metric' ? 'kilogram' : 'pound')
    : grams;
}

function distanceIn(millimeters: number, unitSystem: UnitSystem): number {
  const length = Length.create(millimeters, 'millimeter');
  return length.isSuccess
    ? length.value.in(unitSystem === 'metric' ? 'kilometer' : 'mile')
    : millimeters;
}

function formatSpokenDuration(seconds: number): string {
  const wholeSeconds = Math.round(seconds);
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (hours > 0) return `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`;
  if (minutes > 0)
    return `${plural(minutes, 'minute')} ${plural(remainingSeconds, 'second')}`;
  return plural(remainingSeconds, 'second');
}

function plural(value: number, unit: string): string {
  return `${value} ${value === 1 ? unit : `${unit}s`}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    value,
  );
}
