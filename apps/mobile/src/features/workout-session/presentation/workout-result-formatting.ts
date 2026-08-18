import type {
  ExerciseLoggingMode,
  UnitSystem,
  WorkoutResult,
  WorkoutSession,
} from '@fitness/domain';

/**
 * Three logging modes — external load, added bodyweight load, and assistance —
 * share one `ResistanceRepetitionResult`, so a stored result cannot say what
 * its own mass means. The captured logging mode is the only thing that can, and
 * every screen that renders a result already holds it.
 *
 * The unmarked sentence means load lifted, because that is what a mass beside
 * repetitions conventionally means. Only the two modes that deviate from it are
 * marked, and the mark leads rather than trails: a set row truncates from the
 * end at the largest accessible text size, so a trailing qualifier is the first
 * thing lost, while a leading one survives with the meaning intact.
 */
function resistanceQualifier(loggingMode: ExerciseLoggingMode): string {
  if (loggingMode === 'assistance-and-repetitions') return 'Assistance ';
  if (loggingMode === 'bodyweight-plus-load-and-repetitions') return 'Added ';
  return '';
}

export function formatWorkoutResult(
  result: WorkoutResult,
  unitSystem: UnitSystem,
  loggingMode: ExerciseLoggingMode,
): string {
  const massUnit = unitSystem === 'metric' ? 'kilogram' : 'pound';
  const massLabel = unitSystem === 'metric' ? 'kg' : 'lb';
  const distanceUnit = unitSystem === 'metric' ? 'kilometer' : 'mile';
  const distanceLabel = unitSystem === 'metric' ? 'km' : 'mi';
  if (result.kind === 'repetitions') return `${result.repetitions} reps`;
  if (result.kind === 'resistance-and-repetitions')
    return `${resistanceQualifier(loggingMode)}${result.resistance.in(massUnit)} ${massLabel} × ${result.repetitions}`;
  if (result.kind === 'duration')
    return formatDuration(result.duration.seconds);
  if (result.kind === 'distance')
    return `${result.distance.in(distanceUnit)} ${distanceLabel}`;
  return `${result.distance.in(distanceUnit)} ${distanceLabel} in ${formatDuration(result.duration.seconds)}`;
}

export function formatPlannedWorkoutResult(
  planned: WorkoutSession['exercises'][number]['plannedPrescriptionSnapshot'],
  unitSystem: UnitSystem,
  loggingMode: ExerciseLoggingMode,
): string {
  if (!planned) return '';
  const parts = [`${planned.sets} sets`];
  if ('repetitions' in planned) parts.push(`${planned.repetitions} reps`);
  if ('resistance' in planned && planned.resistance)
    parts.push(
      `${resistanceQualifier(loggingMode)}${planned.resistance.in(unitSystem === 'metric' ? 'kilogram' : 'pound')} ${unitSystem === 'metric' ? 'kg' : 'lb'}`,
    );
  if ('duration' in planned)
    parts.push(formatDuration(planned.duration.seconds));
  if ('distance' in planned)
    parts.push(
      `${planned.distance.in(unitSystem === 'metric' ? 'kilometer' : 'mile')} ${unitSystem === 'metric' ? 'km' : 'mi'}`,
    );
  return parts.join(' · ');
}

export function formatDuration(seconds: number): string {
  const wholeSeconds = Math.round(seconds);
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (hours > 0) return `${hours} hr ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${remainingSeconds} sec`;
  return `${remainingSeconds} sec`;
}
