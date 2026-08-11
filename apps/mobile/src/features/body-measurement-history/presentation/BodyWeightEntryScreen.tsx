import type {
  BodyWeightEntry,
  DomainError,
  UserProfile,
} from '@fitness/domain';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { createBodyMeasurementHistoryUseCases } from '../../../composition/body-measurement-history';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import type {
  BodyWeightCheckInOptions,
  BodyWeightCheckInResult,
} from '../application/create-body-weight-check-in-use-case';
import type {
  SaveBodyWeightEntryInput,
  SaveBodyWeightEntryResult,
} from '../application/build-body-weight-entry';
import {
  convertGrams,
  formatMeasurementTime,
  getBodyWeightDisplayUnit,
  type BodyWeightDisplayUnit,
} from './body-weight-formatting';
import {
  BodyWeightEntryForm,
  toBodyWeightSaveInput,
  type BodyWeightEntryFormValues,
} from './BodyWeightEntryForm';

type UseCases = Readonly<{
  createCheckIn: Readonly<{
    execute: (
      input: SaveBodyWeightEntryInput,
      options?: BodyWeightCheckInOptions,
    ) => Promise<BodyWeightCheckInResult>;
  }>;
  deleteEntry: Readonly<{ execute: (id: unknown) => Promise<boolean> }>;
  getEntry: Readonly<{
    execute: (id: unknown) => Promise<BodyWeightEntry | null>;
  }>;
  getProfile: Readonly<{ execute: () => Promise<UserProfile | null> }>;
  updateEntry: Readonly<{
    execute: (
      id: unknown,
      input: SaveBodyWeightEntryInput,
    ) => Promise<SaveBodyWeightEntryResult>;
  }>;
}>;

type Props = Readonly<{
  entryId?: string;
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
}>;

type Loaded = Readonly<{
  entry: BodyWeightEntry | null;
  profile: UserProfile | null;
  useCases: UseCases;
}>;

export function BodyWeightEntryScreen({
  entryId,
  loadUseCases = createBodyMeasurementHistoryUseCases,
  onDone,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    void loadUseCases()
      .then(async (useCases) => {
        const [profile, entry] = await Promise.all([
          useCases.getProfile.execute(),
          entryId ? useCases.getEntry.execute(entryId) : Promise.resolve(null),
        ]);
        setLoaded({ entry, profile, useCases });
      })
      .catch(() => setErrors({ form: 'Weight check-in could not be loaded.' }));
  }, [entryId, loadUseCases]);

  if (!loaded) {
    if (errors.form)
      return (
        <Screen accessibilityLabel="Weight check-in error" isCentered>
          <AppText accessibilityRole="header" variant="heading">
            Weight check-in unavailable
          </AppText>
          <AppText color="secondary" style={{ marginVertical: spacing.md }}>
            {errors.form}
          </AppText>
          <AppButton label="Back to body measurements" onPress={onDone} />
        </Screen>
      );
    return (
      <Screen accessibilityLabel="Loading weight check-in" isCentered>
        <LoadingIndicator label="Loading weight check-in" />
      </Screen>
    );
  }

  if (entryId && loaded.entry === null)
    return (
      <Screen accessibilityLabel="Weight check-in not found" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Weight check-in not found
        </AppText>
        <AppButton label="Back to body measurements" onPress={onDone} />
      </Screen>
    );

  const unit = getBodyWeightDisplayUnit(loaded.profile?.preferredUnitSystem);

  const save = async (values: BodyWeightEntryFormValues) => {
    const input = toBodyWeightSaveInput(values, unit);
    if (!input) {
      setErrors({
        occurredAtEpochMilliseconds: 'Enter a valid local date and time.',
      });
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      const result = entryId
        ? await loaded.useCases.updateEntry.execute(entryId, input)
        : await loaded.useCases.createCheckIn.execute(input, {
            shouldUpdateProfileWeight:
              values.shouldUpdateProfileWeight === 'yes',
          });
      if (!result.isSuccess) {
        setErrors(toErrorRecord(result.error));
        return;
      }
      onDone();
    } catch {
      setErrors({
        form: 'Weight check-in could not be saved. Nothing was changed.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = () => {
    if (!entryId) return;
    Alert.alert(
      'Delete this weight check-in?',
      'The recorded weight is removed from your history and cannot be recovered. Your profile weight is not changed.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void loaded.useCases.deleteEntry
              .execute(entryId)
              .then((deleted) =>
                deleted
                  ? onDone()
                  : setErrors({ form: 'Weight check-in no longer exists.' }),
              )
              .catch(() =>
                setErrors({ form: 'Weight check-in could not be deleted.' }),
              );
          },
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  };

  return (
    <BodyWeightEntryForm
      canUpdateProfileWeight={!entryId && loaded.profile !== null}
      errors={errors}
      initialValues={
        loaded.entry
          ? editValues(loaded.entry, unit)
          : newValues(loaded.profile, unit)
      }
      isEditing={Boolean(entryId)}
      isSaving={isSaving}
      onCancel={onDone}
      onSave={(values) => void save(values)}
      unit={unit}
      {...(entryId ? { onDelete: requestDelete } : {})}
    />
  );
}

function newValues(
  profile: UserProfile | null,
  unit: BodyWeightDisplayUnit,
): BodyWeightEntryFormValues {
  const now = new Date();
  return {
    date: localDate(now),
    note: '',
    shouldUpdateProfileWeight: 'yes',
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    weight: profile ? formatInput(profile.weight.grams, unit) : '',
  };
}

function editValues(
  entry: BodyWeightEntry,
  unit: BodyWeightDisplayUnit,
): BodyWeightEntryFormValues {
  return {
    date: entry.localCalendarDate,
    note: entry.note ?? '',
    shouldUpdateProfileWeight: 'no',
    time: formatMeasurementTime(entry),
    weight: formatInput(entry.mass.grams, unit),
  };
}

function formatInput(grams: number, unit: BodyWeightDisplayUnit): string {
  return String(Math.round(convertGrams(grams, unit) * 10) / 10);
}

function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toErrorRecord(errors: readonly DomainError[]) {
  return Object.fromEntries(
    errors.map((error) => [error.field ?? 'form', error.message]),
  );
}
