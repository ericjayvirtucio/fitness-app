import type { DomainError } from '@fitness/domain';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { createExerciseCatalogUseCases } from '../../../composition/exercise-catalog';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import type { ExerciseUpdateOutcome } from '../application/exercise-catalog-use-cases';
import {
  ExerciseForm,
  toSaveExerciseInput,
  type ExerciseFormValues,
} from './ExerciseForm';

type UseCases = Awaited<ReturnType<typeof createExerciseCatalogUseCases>>;

export function ExerciseEditorScreen({
  exerciseId,
  loadUseCases = createExerciseCatalogUseCases,
  onDone,
}: Readonly<{
  exerciseId?: string;
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
}>) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [values, setValues] = useState<ExerciseFormValues>();
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [isMissing, setIsMissing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        const item = exerciseId ? await loaded.get.execute(exerciseId) : null;
        if (exerciseId && item === null) {
          setIsMissing(true);
          return;
        }
        setValues(
          item
            ? {
                equipment: item.definition.equipment,
                isFavorite: item.isFavorite,
                loggingMode: item.definition.loggingMode,
                name: item.definition.name,
                notes: item.definition.notes ?? '',
                primaryMuscleGroup: item.definition.primaryMuscleGroup,
              }
            : emptyValues(),
        );
      })
      .catch(() => setErrors({ form: 'Exercise could not be loaded.' }));
  }, [exerciseId, loadUseCases]);
  if (!useCases || !values) {
    if (isMissing || errors.form)
      return (
        <Screen accessibilityLabel="Exercise unavailable" isCentered>
          <AppText accessibilityRole="header" variant="heading">
            Exercise unavailable
          </AppText>
          <AppText color="secondary" style={{ marginVertical: spacing.md }}>
            {errors.form ?? 'The exercise no longer exists.'}
          </AppText>
          <AppButton label="Back" onPress={onDone} />
        </Screen>
      );
    return (
      <Screen accessibilityLabel="Loading exercise" isCentered>
        <LoadingIndicator label="Loading exercise" />
      </Screen>
    );
  }
  const save = async (next: ExerciseFormValues, allowDuplicate = false) => {
    setErrors({});
    setIsSaving(true);
    try {
      const outcome = exerciseId
        ? await useCases.update.execute(
            exerciseId,
            toSaveExerciseInput(next),
            allowDuplicate,
          )
        : await useCases.create.execute(
            toSaveExerciseInput(next),
            allowDuplicate,
          );
      handleOutcome(outcome, next, save, onDone, setErrors);
    } catch {
      setErrors({ form: 'Exercise could not be saved. Nothing was changed.' });
    } finally {
      setIsSaving(false);
    }
  };
  const requestDelete = () => {
    if (!exerciseId) return;
    Alert.alert(
      'Delete exercise?',
      `Delete ${values.name}? This cannot be undone.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () =>
            void useCases.delete
              .execute(exerciseId)
              .then((outcome) => {
                if (outcome.status === 'deleted') onDone();
                else if (outcome.status === 'missing')
                  setErrors({ form: 'Exercise no longer exists.' });
                else
                  setErrors({
                    form: referenceMessage('Remove it from', outcome.usages),
                  });
              })
              .catch(() =>
                setErrors({ form: 'Exercise could not be deleted.' }),
              ),
          style: 'destructive',
          // Deliberately different from the screen's own "Delete exercise"
          // control. The repository's other destructive alerts already read
          // differently from the control that opens them, so no positional
          // selector is needed to tell an alert option from the button behind
          // it; this one predated that convention and could not be confirmed
          // without one.
          text: 'Delete this exercise',
        },
      ],
    );
  };
  return (
    <ExerciseForm
      errors={errors}
      initialValues={values}
      isEditing={Boolean(exerciseId)}
      isSaving={isSaving}
      onCancel={onDone}
      {...(exerciseId ? { onDelete: requestDelete } : {})}
      onSave={(next) => void save(next)}
    />
  );
}

function handleOutcome(
  outcome: ExerciseUpdateOutcome,
  values: ExerciseFormValues,
  save: (values: ExerciseFormValues, allowDuplicate?: boolean) => Promise<void>,
  onDone: () => void,
  setErrors: (errors: Readonly<Record<string, string>>) => void,
) {
  if (outcome.status === 'saved') onDone();
  else if (outcome.status === 'invalid') setErrors(toErrors(outcome.error));
  else if (outcome.status === 'referenced')
    setErrors({
      form: referenceMessage(
        'Remove it from',
        outcome.usages,
        ' before changing how it is logged.',
      ),
    });
  else
    Alert.alert(
      'Exercise name already exists',
      `${outcome.matches.length} exercise${outcome.matches.length === 1 ? '' : 's'} already use this name. Save another?`,
      [
        { style: 'cancel', text: 'Review' },
        { onPress: () => void save(values, true), text: 'Save another' },
      ],
    );
}

function referenceMessage(
  prefix: string,
  usages: readonly Readonly<{
    weekday: { value: number };
    workoutName: string;
  }>[],
  suffix = ' before deleting it.',
): string {
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const plans = usages
    .map(
      (usage) =>
        `${dayNames[usage.weekday.value] ?? 'Unknown day'} (${usage.workoutName})`,
    )
    .join(', ');
  return `${prefix} ${plans}${suffix}`;
}

function toErrors(error: DomainError): Readonly<Record<string, string>> {
  return error.field
    ? { [error.field]: error.message }
    : { form: error.message };
}
function emptyValues(): ExerciseFormValues {
  return {
    equipment: 'none',
    isFavorite: false,
    loggingMode: 'repetitions',
    name: '',
    notes: '',
    primaryMuscleGroup: 'full-body',
  };
}
