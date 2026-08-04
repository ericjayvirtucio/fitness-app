import type { DomainError, HydrationEntry } from '@fitness/domain';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { createHydrationTrackingUseCases } from '../../../composition/hydration-tracking';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import type {
  SaveHydrationEntryInput,
  SaveHydrationEntryResult,
} from '../application/build-hydration-entry';
import {
  HydrationEntryForm,
  toHydrationSaveInput,
  type HydrationEntryFormValues,
} from './HydrationEntryForm';

type UseCases = Readonly<{
  createEntry: Readonly<{
    execute: (
      input: SaveHydrationEntryInput,
    ) => Promise<SaveHydrationEntryResult>;
  }>;
  deleteEntry: Readonly<{ execute: (id: unknown) => Promise<boolean> }>;
  getEntry: Readonly<{
    execute: (id: unknown) => Promise<HydrationEntry | null>;
  }>;
  updateEntry: Readonly<{
    execute: (
      id: unknown,
      input: SaveHydrationEntryInput,
    ) => Promise<SaveHydrationEntryResult>;
  }>;
}>;

type Props = Readonly<{
  entryId?: string;
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
}>;

export function HydrationEntryScreen({
  entryId,
  loadUseCases = createHydrationTrackingUseCases,
  onDone,
}: Props) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [entry, setEntry] = useState<HydrationEntry | null>();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        setEntry(entryId ? await loaded.getEntry.execute(entryId) : null);
      })
      .catch(() => setErrors({ form: 'Fluid entry could not be loaded.' }));
  }, [entryId, loadUseCases]);

  if (!useCases || entry === undefined) {
    if (errors.form) {
      return (
        <Screen accessibilityLabel="Hydration entry error" isCentered>
          <AppText accessibilityRole="header" variant="heading">
            Fluid entry unavailable
          </AppText>
          <AppText color="secondary" style={{ marginVertical: spacing.md }}>
            {errors.form}
          </AppText>
          <AppButton label="Back to hydration" onPress={onDone} />
        </Screen>
      );
    }
    return (
      <Screen accessibilityLabel="Loading hydration entry" isCentered>
        <LoadingIndicator label="Loading hydration entry" />
      </Screen>
    );
  }
  if (entryId && entry === null) {
    return (
      <Screen accessibilityLabel="Hydration entry not found" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Fluid entry not found
        </AppText>
        <AppButton label="Back to hydration" onPress={onDone} />
      </Screen>
    );
  }

  const save = async (values: HydrationEntryFormValues) => {
    const input = toHydrationSaveInput(values);
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
        ? await useCases.updateEntry.execute(entryId, input)
        : await useCases.createEntry.execute(input);
      if (!result.isSuccess) {
        setErrors(toErrorRecord(result.error));
        return;
      }
      onDone();
    } catch {
      setErrors({ form: 'Fluid entry could not be saved. Nothing changed.' });
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = () => {
    if (!entryId) return;
    Alert.alert(
      'Delete fluid entry?',
      'This removes the entry and cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void useCases.deleteEntry
              .execute(entryId)
              .then((deleted) =>
                deleted
                  ? onDone()
                  : setErrors({ form: 'Fluid entry no longer exists.' }),
              )
              .catch(() =>
                setErrors({ form: 'Fluid entry could not be deleted.' }),
              );
          },
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  };

  return (
    <HydrationEntryForm
      errors={errors}
      initialValues={entry ? formValues(entry) : emptyFormValues()}
      isSaving={isSaving}
      onCancel={onDone}
      onSave={(values) => void save(values)}
      {...(entryId ? { onDelete: requestDelete } : {})}
    />
  );
}

function emptyFormValues(): HydrationEntryFormValues {
  const now = new Date();
  return {
    date: localDate(now),
    description: '',
    fluidType: 'plain-water',
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    volumeMilliliters: '',
  };
}

function formValues(entry: HydrationEntry): HydrationEntryFormValues {
  const shifted = new Date(
    entry.occurredAtEpochMilliseconds + entry.utcOffsetMinutes * 60_000,
  );
  return {
    date: entry.localCalendarDate,
    description: entry.description ?? '',
    fluidType: entry.fluidType,
    time: `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`,
    volumeMilliliters: String(entry.volume.milliliters),
  };
}

function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toErrorRecord(errors: readonly DomainError[]) {
  return Object.fromEntries(
    errors.map((error) => [error.field ?? 'form', error.message]),
  );
}
