import {
  DomainId,
  Duration,
  Length,
  Mass,
  PlannedExercise,
  PlannedWorkout,
  Weekday,
  createPlannedPrescription,
  type ExerciseDefinition,
  type UnitSystem,
} from '@fitness/domain';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { createWorkoutPlannerUseCases } from '../../../composition/workout-planner';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SelectionField,
  TextField,
  spacing,
} from '../../../design-system';
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { PlannedWorkoutDetails } from '../application/workout-planner-repository';
import { ExercisePicker } from './ExercisePicker';
import { weekdayLabels } from './workout-formatting';

type UseCases = Awaited<ReturnType<typeof createWorkoutPlannerUseCases>>;
type DurationInputUnit = 'minute' | 'second';
type DraftExercise = Readonly<{
  definition: ExerciseDefinition;
  distance: string;
  duration: string;
  durationUnit: DurationInputUnit;
  id: string;
  repetitions: string;
  resistance: string;
  sets: string;
}>;
type Draft = Readonly<{ exercises: readonly DraftExercise[]; name: string }>;
type State =
  | { status: 'loading' }
  | { status: 'missing' | 'error' }
  | {
      draft: Draft;
      existing: PlannedWorkoutDetails | null;
      isPicking: boolean;
      status: 'ready';
      units: UnitSystem;
      useCases: UseCases;
    };

export function PlannedWorkoutEditorScreen({
  loadUseCases = createWorkoutPlannerUseCases,
  onDone,
  weekdayValue,
}: Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
  weekdayValue: unknown;
}>) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    const weekday = Weekday.create(weekdayValue);
    if (!weekday.isSuccess) {
      setState({ status: 'missing' });
      return;
    }
    void loadUseCases()
      .then(async (useCases) => {
        const [existing, profile] = await Promise.all([
          useCases.get.execute(weekday.value.value),
          useCases.getProfile.execute(),
        ]);
        const units = profile?.preferredUnitSystem ?? 'metric';
        setState({
          draft: existing
            ? toDraft(existing, units)
            : { exercises: [], name: '' },
          existing,
          isPicking: false,
          status: 'ready',
          units,
          useCases,
        });
      })
      .catch(() => setState({ status: 'error' }));
  }, [loadUseCases, weekdayValue]);

  if (state.status === 'loading')
    return (
      <Screen accessibilityLabel="Loading planned workout" isCentered>
        <LoadingIndicator label="Loading planned workout" />
      </Screen>
    );
  if (state.status === 'missing' || state.status === 'error')
    return (
      <Screen accessibilityLabel="Planned workout unavailable" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Planned workout unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          {state.status === 'missing'
            ? 'Choose a valid day from the weekly plan.'
            : 'The planned workout could not be loaded. Nothing was changed.'}
        </AppText>
        <AppButton label="Back" onPress={onDone} />
      </Screen>
    );

  if (state.status !== 'ready') return null;

  const weekday = Weekday.create(weekdayValue);
  if (!weekday.isSuccess) return null;
  const update = (draft: Draft) => setState({ ...state, draft });
  const add = (item: ExerciseCatalogItem) => {
    const commit = () => {
      update({
        ...state.draft,
        exercises: [
          ...state.draft.exercises,
          emptyDraftExercise(item.definition, state.useCases.generateId()),
        ],
      });
      setState((current) =>
        current.status === 'ready' ? { ...current, isPicking: false } : current,
      );
    };
    if (
      state.draft.exercises.some((exercise) =>
        exercise.definition.id.equals(item.definition.id),
      )
    )
      Alert.alert(
        'Exercise already planned',
        `${item.definition.name} is already in this workout. Add it again?`,
        [
          { style: 'cancel', text: 'Cancel' },
          { onPress: commit, text: 'Add another' },
        ],
      );
    else commit();
  };
  const save = async () => {
    setErrors({});
    const result = buildWorkout(
      state.existing?.workout.id.value ?? state.useCases.generateId(),
      weekday.value,
      state.draft,
      state.units,
    );
    if ('error' in result) {
      setErrors(
        result.field
          ? { [result.field]: result.error }
          : { form: result.error },
      );
      return;
    }
    setIsSaving(true);
    try {
      const outcome = await state.useCases.save.execute(result.workout);
      if (outcome.status === 'saved') onDone();
      else
        setErrors(
          outcome.error.field
            ? { [outcome.error.field]: outcome.error.message }
            : { form: outcome.error.message },
        );
    } catch {
      setErrors({ form: 'Workout could not be saved. Nothing was changed.' });
    } finally {
      setIsSaving(false);
    }
  };
  const requestRest = () =>
    Alert.alert(
      'Change workout to Rest?',
      `Remove ${state.existing?.workout.name ?? 'this workout'} and its ${state.draft.exercises.length} planned exercise${state.draft.exercises.length === 1 ? '' : 's'}?`,
      [
        { style: 'cancel', text: 'Keep workout' },
        {
          onPress: () =>
            void state.useCases.setRest
              .execute(weekday.value.value)
              .then(() => onDone())
              .catch(() =>
                setErrors({ form: 'Workout could not be changed to Rest.' }),
              ),
          style: 'destructive',
          text: 'Change to Rest',
        },
      ],
    );

  return (
    <Screen
      accessibilityLabel={`Plan ${weekdayLabels[weekday.value.value]}`}
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          {weekdayLabels[weekday.value.value]}
        </AppText>
        <AppText color="secondary">
          Plan future intent only. No workout results are recorded.
        </AppText>
      </View>
      {state.isPicking ? (
        <ExercisePicker
          browse={state.useCases.browseExercises}
          onCancel={() => setState({ ...state, isPicking: false })}
          onSelect={add}
        />
      ) : (
        <>
          <TextField
            error={errors.name}
            label="Workout name"
            testID="planned-workout-name"
            onChangeText={(name) => update({ ...state.draft, name })}
            value={state.draft.name}
          />
          {state.draft.exercises.map((exercise, index) => (
            <PlannedExerciseFields
              draft={exercise}
              errors={errors}
              index={index}
              isLast={index === state.draft.exercises.length - 1}
              key={exercise.id}
              onChange={(next) =>
                update({
                  ...state.draft,
                  exercises: state.draft.exercises.map((candidate) =>
                    candidate.id === next.id ? next : candidate,
                  ),
                })
              }
              onMove={(offset) =>
                update({
                  ...state.draft,
                  exercises: move(state.draft.exercises, index, index + offset),
                })
              }
              onRemove={() =>
                update({
                  ...state.draft,
                  exercises: state.draft.exercises.filter(
                    (candidate) => candidate.id !== exercise.id,
                  ),
                })
              }
              units={state.units}
            />
          ))}
          <AppButton
            label="Add exercise"
            onPress={() => setState({ ...state, isPicking: true })}
            variant="outline"
          />
          {errors.exercises || errors.form ? (
            <AppText accessibilityLiveRegion="polite" color="danger">
              {errors.exercises ?? errors.form}
            </AppText>
          ) : null}
          <AppButton
            isLoading={isSaving}
            label="Save workout"
            testID="save-planned-workout"
            onPress={() => void save()}
          />
          <AppButton label="Cancel" onPress={onDone} variant="ghost" />
          {state.existing ? (
            <AppButton
              label="Change to Rest"
              onPress={requestRest}
              variant="danger"
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function PlannedExerciseFields({
  draft,
  errors,
  index,
  isLast,
  onChange,
  onMove,
  onRemove,
  units,
}: Readonly<{
  draft: DraftExercise;
  errors: Readonly<Record<string, string>>;
  index: number;
  isLast: boolean;
  onChange: (draft: DraftExercise) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
  units: UnitSystem;
}>) {
  const mode = draft.definition.loggingMode;
  const hasRepetitions = mode.includes('repetitions');
  const hasResistance =
    mode === 'external-load-and-repetitions' ||
    mode === 'bodyweight-plus-load-and-repetitions' ||
    mode === 'assistance-and-repetitions';
  const hasDuration = mode === 'duration' || mode === 'distance-and-duration';
  const hasDistance = mode === 'distance' || mode === 'distance-and-duration';
  const resistanceLabel =
    mode === 'assistance-and-repetitions'
      ? 'Assistance amount'
      : mode === 'bodyweight-plus-load-and-repetitions'
        ? 'Added weight'
        : 'Planned weight';
  const set = (key: keyof DraftExercise, value: string) =>
    onChange({ ...draft, [key]: value });
  return (
    <Card variant="outlined">
      <AppText variant="heading">{draft.definition.name}</AppText>
      <TextField
        error={errors[`${draft.id}.sets`]}
        keyboardType="number-pad"
        label="Sets"
        testID={`planned-sets-${index}`}
        onChangeText={(value) => set('sets', value)}
        value={draft.sets}
      />
      {hasRepetitions ? (
        <TextField
          keyboardType="number-pad"
          label="Repetitions"
          testID={`planned-repetitions-${index}`}
          onChangeText={(value) => set('repetitions', value)}
          value={draft.repetitions}
        />
      ) : null}
      {hasResistance ? (
        <TextField
          helperText="Optional"
          keyboardType="decimal-pad"
          label={`${resistanceLabel} (${units === 'imperial' ? 'lb' : 'kg'})`}
          onChangeText={(value) => set('resistance', value)}
          value={draft.resistance}
        />
      ) : null}
      {hasDuration ? (
        <>
          <TextField
            keyboardType="decimal-pad"
            label="Duration"
            onChangeText={(value) => set('duration', value)}
            value={draft.duration}
          />
          <SelectionField
            label="Duration unit"
            onChange={(durationUnit) => onChange({ ...draft, durationUnit })}
            options={[
              { label: 'Seconds', value: 'second' },
              { label: 'Minutes', value: 'minute' },
            ]}
            value={draft.durationUnit}
          />
        </>
      ) : null}
      {hasDistance ? (
        <TextField
          keyboardType="decimal-pad"
          label={`Distance (${units === 'imperial' ? 'mi' : 'km'})`}
          onChangeText={(value) => set('distance', value)}
          value={draft.distance}
        />
      ) : null}
      <AppButton
        accessibilityLabel={`Move ${draft.definition.name} up`}
        disabled={index === 0}
        label="Move up"
        onPress={() => onMove(-1)}
        variant="outline"
      />
      <AppButton
        accessibilityLabel={`Move ${draft.definition.name} down`}
        disabled={isLast}
        label="Move down"
        onPress={() => onMove(1)}
        variant="outline"
      />
      <AppButton
        accessibilityLabel={`Remove ${draft.definition.name}`}
        label="Remove exercise"
        onPress={onRemove}
        variant="danger"
      />
    </Card>
  );
}

function buildWorkout(
  idValue: string,
  weekday: Weekday,
  draft: Draft,
  units: UnitSystem,
): { workout: PlannedWorkout } | { error: string; field?: string | undefined } {
  const id = DomainId.create(idValue);
  if (!id.isSuccess) return { error: id.error.message };
  const exercises: PlannedExercise[] = [];
  for (const [position, item] of draft.exercises.entries()) {
    const resistance =
      item.resistance.trim() === ''
        ? undefined
        : Mass.create(
            Number(item.resistance),
            units === 'imperial' ? 'pound' : 'kilogram',
          );
    if (resistance && !resistance.isSuccess)
      return { error: resistance.error.message };
    const duration = Duration.create(Number(item.duration), item.durationUnit);
    const distance = Length.create(
      Number(item.distance),
      units === 'imperial' ? 'mile' : 'kilometer',
    );
    const target = createPlannedPrescription({
      ...(distance.isSuccess ? { distance: distance.value } : {}),
      ...(duration.isSuccess ? { duration: duration.value } : {}),
      loggingMode: item.definition.loggingMode,
      repetitions: Number(item.repetitions),
      ...(resistance?.isSuccess ? { resistance: resistance.value } : {}),
      sets: Number(item.sets),
    });
    if (!target.isSuccess)
      return { error: target.error.message, field: 'exercises' };
    const exerciseId = DomainId.create(item.id);
    if (!exerciseId.isSuccess) return { error: exerciseId.error.message };
    const exercise = PlannedExercise.create({
      exerciseDefinitionId: item.definition.id,
      id: exerciseId.value,
      position,
      prescription: target.value,
    });
    if (!exercise.isSuccess)
      return { error: exercise.error.message, field: 'exercises' };
    exercises.push(exercise.value);
  }
  const workout = PlannedWorkout.create({
    exercises,
    id: id.value,
    name: draft.name,
    weekday,
  });
  return workout.isSuccess
    ? { workout: workout.value }
    : { error: workout.error.message, field: workout.error.field };
}

function emptyDraftExercise(
  definition: ExerciseDefinition,
  id: string,
): DraftExercise {
  return {
    definition,
    distance: '1',
    duration: '1',
    durationUnit: 'minute',
    id,
    repetitions: '1',
    resistance: '',
    sets: '1',
  };
}

function toDraft(details: PlannedWorkoutDetails, units: UnitSystem): Draft {
  return {
    exercises: details.exercises.map(({ definition, plannedExercise }) => {
      const target = plannedExercise.prescription;
      const duration = 'duration' in target ? target.duration.seconds : 60;
      const durationUnit: DurationInputUnit =
        duration % 60 === 0 ? 'minute' : 'second';
      return {
        definition,
        distance:
          'distance' in target
            ? String(
                target.distance.in(units === 'imperial' ? 'mile' : 'kilometer'),
              )
            : '1',
        duration: String(durationUnit === 'minute' ? duration / 60 : duration),
        durationUnit,
        id: plannedExercise.id.value,
        repetitions: 'repetitions' in target ? String(target.repetitions) : '1',
        resistance:
          'resistance' in target && target.resistance
            ? String(
                target.resistance.in(
                  units === 'imperial' ? 'pound' : 'kilogram',
                ),
              )
            : '',
        sets: String(target.sets),
      };
    }),
    name: details.workout.name,
  };
}

function move<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (to < 0 || to >= items.length) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  if (item === undefined) return items;
  result.splice(to, 0, item);
  return result;
}

export { buildWorkout };
