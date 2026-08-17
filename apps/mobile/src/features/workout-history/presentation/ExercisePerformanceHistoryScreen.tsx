import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import type { ExerciseLoggingMode, UnitSystem } from '@fitness/domain';
import { createWorkoutHistoryUseCases } from '../../../composition/workout-history';
import {
  AppButton,
  AppText,
  Card,
  EmptyState,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import {
  labelFor,
  loggingModeOptions,
} from '../../exercise-catalog/presentation/exercise-options';
import {
  personalRecordDescriptor,
  type ExercisePersonalRecord,
  type ExercisePersonalRecords,
} from '../application/exercise-personal-records';
import type {
  ExercisePerformanceItem,
  ExercisePerformancePage,
} from '../application/workout-history-models';
import {
  describePersonalRecord,
  formatCapturedDate,
  formatPersonalRecordValue,
  formatRecordedDistance,
  formatRecordedLoadVolume,
  formatRecordedMass,
} from './workout-history-formatting';
import { formatDuration } from '../../workout-session/presentation/workout-result-formatting';

type UseCases = Awaited<ReturnType<typeof createWorkoutHistoryUseCases>>;

export function ExercisePerformanceHistoryScreen({
  exerciseDefinitionId,
  loadUseCases = createWorkoutHistoryUseCases,
  onClose,
  onOpenSession,
}: Readonly<{
  exerciseDefinitionId: string;
  loadUseCases?: () => Promise<UseCases>;
  onClose: () => void;
  onOpenSession: (id: string) => void;
}>) {
  const [page, setPage] = useState<ExercisePerformancePage>();
  const [records, setRecords] = useState<ExercisePersonalRecords>();
  const [recordsError, setRecordsError] = useState<string>();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [useCases, setUseCases] = useState<UseCases>();
  const [error, setError] = useState<string>();
  /**
   * The screen reloads whenever it regains focus, so a slow earlier response
   * must not overwrite a newer one.
   */
  const requestRef = useRef(0);

  const loadRecords = useCallback(
    (loaded: UseCases, request: number) => {
      setRecordsError(undefined);
      return loaded.getPersonalRecords
        .execute(exerciseDefinitionId)
        .then((found) => {
          if (request !== requestRef.current || found === null) return;
          setRecords(found);
        })
        .catch(() => {
          if (request !== requestRef.current) return;
          setRecordsError('Personal records could not be loaded.');
        });
    },
    [exerciseDefinitionId],
  );

  const load = useCallback(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    void loadUseCases()
      .then(async (loaded) => {
        const [history, profile] = await Promise.all([
          loaded.listExercisePerformance.execute(exerciseDefinitionId),
          loaded.getProfile.execute(),
        ]);
        if (request !== requestRef.current) return;
        setUseCases(loaded);
        setPage(history ?? { items: [], nextCursor: null });
        setUnitSystem(profile?.preferredUnitSystem ?? 'metric');
        void loadRecords(loaded, request);
      })
      .catch(() => {
        if (request !== requestRef.current) return;
        setError('Exercise performance could not be loaded.');
      });
  }, [exerciseDefinitionId, loadRecords, loadUseCases]);
  useFocusEffect(load);

  if (!page && !error)
    return (
      <Screen accessibilityLabel="Loading exercise performance" isCentered>
        <LoadingIndicator label="Loading exercise performance" />
      </Screen>
    );
  if (!page)
    return (
      <Screen accessibilityLabel="Exercise performance error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Exercise performance unavailable
        </AppText>
        <AppText color="secondary">{error}</AppText>
        <AppButton label="Back to History" onPress={onClose} />
      </Screen>
    );

  const name =
    records?.latestExerciseNameSnapshot ??
    page.items[0]?.exerciseNameSnapshot ??
    'Exercise performance';
  const loadMore = () => {
    if (!page.nextCursor || !useCases) return;
    void useCases.listExercisePerformance
      .execute(exerciseDefinitionId, { cursor: page.nextCursor })
      .then((next) => {
        if (!next) return;
        setPage({
          items: [...page.items, ...next.items],
          nextCursor: next.nextCursor,
        });
      })
      .catch(() => setError('More exercise performance could not be loaded.'));
  };
  const retryRecords = () => {
    if (useCases) void loadRecords(useCases, requestRef.current);
    else load();
  };

  return (
    <Screen
      contentContainerStyle={{ gap: spacing.xl }}
      testID="exercise-performance-screen"
    >
      <AppText accessibilityRole="header" variant="display">
        {name}
      </AppText>
      <AppText color="secondary">
        Performed results from completed workout snapshots.
      </AppText>
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}
      {page.items.length === 0 ? (
        <EmptyState
          description="No completed performed sets are available for this exercise."
          title="No exercise history"
        />
      ) : (
        <>
          <PersonalRecords
            error={recordsError}
            exerciseName={name}
            onOpenSession={onOpenSession}
            onRetry={retryRecords}
            records={records}
            unitSystem={unitSystem}
          />
          <SectionHeader title="Performed sessions" />
          {page.items.map((item, index) => (
            <PerformanceCard
              item={item}
              key={`${item.sessionId.value}-${item.startedAtEpochMilliseconds}-${index}`}
              onOpenSession={onOpenSession}
              unitSystem={unitSystem}
            />
          ))}
        </>
      )}
      {page.nextCursor ? (
        <AppButton
          label="Load More Performance"
          onPress={loadMore}
          variant="outline"
        />
      ) : null}
      <AppButton label="Back to History" onPress={onClose} variant="ghost" />
    </Screen>
  );
}

function PersonalRecords({
  error,
  exerciseName,
  onOpenSession,
  onRetry,
  records,
  unitSystem,
}: Readonly<{
  error: string | undefined;
  exerciseName: string;
  onOpenSession: (id: string) => void;
  onRetry: () => void;
  records: ExercisePersonalRecords | undefined;
  unitSystem: UnitSystem;
}>) {
  const modes = records ? recordedLoggingModes(records) : [];
  return (
    <View style={{ gap: spacing.md }} testID="exercise-personal-records">
      <SectionHeader title="Personal records" />
      {error ? (
        <>
          <AppText accessibilityLiveRegion="polite" color="danger">
            {error}
          </AppText>
          <AppButton label="Try Again" onPress={onRetry} variant="outline" />
        </>
      ) : null}
      {!records && !error ? (
        <LoadingIndicator label="Loading personal records" />
      ) : null}
      {records && modes.length === 0 ? (
        <AppText color="secondary">
          No completed set has established a record for this exercise yet.
        </AppText>
      ) : null}
      {records
        ? modes.map((mode) => (
            <View key={mode} style={{ gap: spacing.md }}>
              {modes.length > 1 ? (
                <AppText accessibilityRole="header" variant="heading">
                  Recorded as {labelFor(loggingModeOptions, mode)}
                </AppText>
              ) : null}
              {records.records
                .filter((record) => record.loggingMode === mode)
                .map((record) => (
                  <PersonalRecordCard
                    exerciseName={exerciseName}
                    key={record.category}
                    onOpenSession={onOpenSession}
                    record={record}
                    unitSystem={unitSystem}
                  />
                ))}
              {/*
               * Every logging mode the domain defines now has a descriptor, so
               * this explains a mode added to the domain before one describes
               * what may be claimed about it. It is reached through the read
               * model rather than through any mode name.
               */}
              {records.unsupportedLoggingModes.includes(mode) ? (
                <AppText color="secondary">
                  Personal records are not available for this way of recording
                  yet.
                </AppText>
              ) : null}
            </View>
          ))
        : null}
    </View>
  );
}

function PersonalRecordCard({
  exerciseName,
  onOpenSession,
  record,
  unitSystem,
}: Readonly<{
  exerciseName: string;
  onOpenSession: (id: string) => void;
  record: ExercisePersonalRecord;
  unitSystem: UnitSystem;
}>) {
  /**
   * History owns its own names, so a record keeps the name captured when it was
   * set. It is only worth showing when it differs from the heading above.
   */
  const showsCapturedName =
    record.occurrence.exerciseNameSnapshot !== exerciseName;
  return (
    <Card
      accessibilityLabel={describePersonalRecord(
        record,
        unitSystem,
        showsCapturedName,
      )}
      onPress={() => onOpenSession(record.occurrence.sessionId.value)}
      testID="personal-record-card"
      variant="outlined"
    >
      <AppText variant="heading">
        {personalRecordDescriptor(record.category).label}
      </AppText>
      <AppText variant="display">
        {formatPersonalRecordValue(record, unitSystem)}
      </AppText>
      <AppText>
        First recorded on{' '}
        {formatCapturedDate(record.occurrence.startedLocalCalendarDate)}
      </AppText>
      <AppText color="secondary">
        {record.occurrence.sessionNameSnapshot} · Set{' '}
        {record.occurrence.setPosition + 1}
      </AppText>
      {showsCapturedName ? (
        <AppText color="secondary">
          Recorded as {record.occurrence.exerciseNameSnapshot}
        </AppText>
      ) : null}
    </Card>
  );
}

/**
 * Modes in the order the reader returned them: recorded modes first, then any
 * this version cannot compare, so an unsupported mode is explained rather than
 * dropped.
 */
function recordedLoggingModes(
  records: ExercisePersonalRecords,
): readonly ExerciseLoggingMode[] {
  return [
    ...new Set([
      ...records.records.map((record) => record.loggingMode),
      ...records.unsupportedLoggingModes,
    ]),
  ];
}

function PerformanceCard({
  item,
  onOpenSession,
  unitSystem,
}: Readonly<{
  item: ExercisePerformanceItem;
  onOpenSession: (id: string) => void;
  unitSystem: UnitSystem;
}>) {
  const values = formatPerformance(item, unitSystem);
  return (
    <Card
      accessibilityLabel={`Open ${item.sessionNameSnapshot}, ${item.startedLocalCalendarDate}, ${values.join(', ')}`}
      onPress={() => onOpenSession(item.sessionId.value)}
      variant="outlined"
    >
      <AppText variant="heading">{item.sessionNameSnapshot}</AppText>
      <AppText>{item.startedLocalCalendarDate}</AppText>
      <AppText color="secondary">{values.join(' · ')}</AppText>
    </Card>
  );
}

function formatPerformance(
  item: ExercisePerformanceItem,
  unitSystem: UnitSystem,
) {
  const values = [`${item.actualSetCount} actual sets`];
  if (item.repetitions !== null) values.push(`${item.repetitions} repetitions`);
  if (item.maximumResistanceGrams !== null)
    values.push(
      `${formatRecordedMass(item.maximumResistanceGrams, unitSystem)} maximum ${item.loggingModeSnapshot === 'assistance-and-repetitions' ? 'assistance' : 'resistance'}`,
    );
  if (item.durationSeconds !== null)
    values.push(`${formatDuration(item.durationSeconds)} duration`);
  if (item.distanceMillimeters !== null)
    values.push(
      `${formatRecordedDistance(item.distanceMillimeters, unitSystem)} distance`,
    );
  if (item.recordedLoadVolumeGramRepetitions !== null)
    values.push(
      `${formatRecordedLoadVolume(item.recordedLoadVolumeGramRepetitions, unitSystem)} recorded load volume`,
    );
  return values;
}
