import { useState } from 'react';
import { View } from 'react-native';
import {
  Duration,
  Length,
  Mass,
  createWorkoutResult,
  type ExerciseLoggingMode,
  type UnitSystem,
  type WorkoutResult,
} from '@fitness/domain';
import { AppButton, AppText, TextField, spacing } from '../../../design-system';

/**
 * The one place a recorded result is entered and validated.
 *
 * Labels are overridable because correcting completed history is a different
 * act from logging an active workout, while the values, units, and domain
 * validation must stay identical between them.
 */
export function WorkoutSetForm({
  cancelLabel = 'Cancel Set',
  heading,
  initial,
  loggingMode,
  onCancel,
  onSave,
  saveLabel = 'Save Set',
  unitSystem,
}: Readonly<{
  cancelLabel?: string;
  heading?: string;
  initial?: WorkoutResult;
  loggingMode: ExerciseLoggingMode;
  onCancel: () => void;
  onSave: (result: WorkoutResult) => Promise<void>;
  saveLabel?: string;
  unitSystem: UnitSystem;
}>) {
  const [repetitions, setRepetitions] = useState(
    initial && 'repetitions' in initial ? String(initial.repetitions) : '',
  );
  const [resistance, setResistance] = useState(
    initial && 'resistance' in initial
      ? String(
          initial.resistance.in(unitSystem === 'metric' ? 'kilogram' : 'pound'),
        )
      : '',
  );
  const [duration, setDuration] = useState(
    initial && 'duration' in initial
      ? String(initial.duration.in('second'))
      : '',
  );
  const [distance, setDistance] = useState(
    initial && 'distance' in initial
      ? String(
          initial.distance.in(unitSystem === 'metric' ? 'kilometer' : 'mile'),
        )
      : '',
  );
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const hasRepetitions = loggingMode.includes('repetitions');
  const hasResistance =
    loggingMode === 'external-load-and-repetitions' ||
    loggingMode === 'bodyweight-plus-load-and-repetitions' ||
    loggingMode === 'assistance-and-repetitions';
  const hasDuration =
    loggingMode === 'duration' || loggingMode === 'distance-and-duration';
  const hasDistance =
    loggingMode === 'distance' || loggingMode === 'distance-and-duration';

  return (
    <View style={{ gap: spacing.md }}>
      <AppText accessibilityRole="header" variant="heading">
        {heading ?? (initial ? 'Edit set' : 'Add set')}
      </AppText>
      {hasResistance ? (
        <TextField
          keyboardType="decimal-pad"
          label={
            loggingMode === 'assistance-and-repetitions'
              ? `Assistance (${unitSystem === 'metric' ? 'kg' : 'lb'})`
              : loggingMode === 'bodyweight-plus-load-and-repetitions'
                ? `Added weight (${unitSystem === 'metric' ? 'kg' : 'lb'})`
                : `Weight (${unitSystem === 'metric' ? 'kg' : 'lb'})`
          }
          onChangeText={setResistance}
          testID="workout-set-resistance-input"
          value={resistance}
        />
      ) : null}
      {hasRepetitions ? (
        <TextField
          keyboardType="number-pad"
          label="Repetitions"
          onChangeText={setRepetitions}
          testID="workout-set-repetitions-input"
          value={repetitions}
        />
      ) : null}
      {/*
       * Both fields carry an identifier for the same reason the two above them
       * do: `TextField` renders its label as text and puts the same string on
       * the input's accessible name, so "Duration (seconds)" matches two
       * elements and choosing one would be a coincidence rather than a
       * selector.
       */}
      {hasDuration ? (
        <TextField
          keyboardType="decimal-pad"
          label="Duration (seconds)"
          onChangeText={setDuration}
          testID="workout-set-duration-input"
          value={duration}
        />
      ) : null}
      {hasDistance ? (
        <TextField
          keyboardType="decimal-pad"
          label={`Distance (${unitSystem === 'metric' ? 'km' : 'mi'})`}
          onChangeText={setDistance}
          testID="workout-set-distance-input"
          value={distance}
        />
      ) : null}
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}
      <AppButton
        isLoading={isSaving}
        label={saveLabel}
        onPress={() => {
          const mass = hasResistance
            ? Mass.create(
                Number(resistance),
                unitSystem === 'metric' ? 'kilogram' : 'pound',
              )
            : null;
          const seconds = hasDuration
            ? Duration.create(Number(duration), 'second')
            : null;
          const length = hasDistance
            ? Length.create(
                Number(distance),
                unitSystem === 'metric' ? 'kilometer' : 'mile',
              )
            : null;
          const result = createWorkoutResult({
            ...(length?.isSuccess ? { distance: length.value } : {}),
            ...(seconds?.isSuccess ? { duration: seconds.value } : {}),
            loggingMode,
            repetitions: Number(repetitions),
            ...(mass?.isSuccess ? { resistance: mass.value } : {}),
          });
          if (!result.isSuccess) {
            setError('Enter valid values for this set.');
            return;
          }
          setIsSaving(true);
          void onSave(result.value).catch(() => {
            setError('Set could not be saved. Your values are still here.');
            setIsSaving(false);
          });
        }}
      />
      <AppButton label={cancelLabel} onPress={onCancel} variant="ghost" />
    </View>
  );
}
