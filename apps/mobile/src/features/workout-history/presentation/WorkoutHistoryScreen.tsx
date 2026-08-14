import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import type { UnitSystem } from '@fitness/domain';
import { createWorkoutHistoryUseCases } from '../../../composition/workout-history';
import {
  AppButton,
  AppText,
  Card,
  EmptyState,
  LoadingIndicator,
  Screen,
  SectionHeader,
  SelectionField,
  spacing,
} from '../../../design-system';
import type {
  PerformedExerciseSummary,
  WorkoutHistoryListItem,
  WorkoutHistoryPage,
  WorkoutProgressSummary,
} from '../application/workout-history-models';
import {
  getWorkoutHistoryPeriodDetails,
  moveWorkoutHistoryPeriod,
  type WorkoutHistoryPeriod,
} from './workout-history-period';
import { deletionConfirmedMessage } from './completed-workout-deletion-messages';
import {
  formatCapturedDate,
  formatRecordedDistance,
  formatRecordedLoadVolume,
} from './workout-history-formatting';
import { formatDuration } from '../../workout-session/presentation/workout-result-formatting';

type UseCases = Awaited<ReturnType<typeof createWorkoutHistoryUseCases>>;
type ReadyState = Readonly<{
  page: WorkoutHistoryPage;
  performedExercises: readonly PerformedExerciseSummary[];
  summary: WorkoutProgressSummary;
  unitSystem: UnitSystem;
  useCases: UseCases;
}>;

export function WorkoutHistoryScreen({
  hasDeletedWorkout = false,
  loadUseCases = createWorkoutHistoryUseCases,
  onOpenSession,
  onOpenExercise,
}: Readonly<{
  hasDeletedWorkout?: boolean;
  loadUseCases?: () => Promise<UseCases>;
  onOpenSession: (id: string) => void;
  onOpenExercise: (id: string) => void;
}>) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [period, setPeriod] = useState<WorkoutHistoryPeriod>('week');
  const [ready, setReady] = useState<ReadyState>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const periodDetails = getWorkoutHistoryPeriodDetails(anchor, period);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(undefined);
    void loadUseCases()
      .then(async (useCases) => {
        const [page, summary, profile, performedExercises] = await Promise.all([
          useCases.list.execute(),
          useCases.getSummary.execute(periodDetails.range),
          useCases.getProfile.execute(),
          useCases.listPerformedExercises.execute(),
        ]);
        setReady({
          page,
          performedExercises,
          summary,
          unitSystem: profile?.preferredUnitSystem ?? 'metric',
          useCases,
        });
      })
      .catch(() => setError('Workout history could not be loaded.'))
      .finally(() => setIsLoading(false));
  }, [
    loadUseCases,
    periodDetails.range.endLocalCalendarDate,
    periodDetails.range.startLocalCalendarDate,
  ]);
  useFocusEffect(load);

  const selectPeriod = (value: WorkoutHistoryPeriod) => {
    setPeriod(value);
    setAnchor(new Date());
  };

  if (isLoading && !ready)
    return (
      <Screen accessibilityLabel="Loading workout history" isCentered>
        <LoadingIndicator label="Loading workout history" />
      </Screen>
    );
  if (!ready)
    return (
      <Screen accessibilityLabel="Workout history error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          History unavailable
        </AppText>
        <AppText color="secondary">{error}</AppText>
        <AppButton label="Try Again" onPress={load} />
      </Screen>
    );

  const loadMore = () => {
    if (!ready.page.nextCursor) return;
    void ready.useCases.list
      .execute({ cursor: ready.page.nextCursor })
      .then((next) =>
        setReady({
          ...ready,
          page: {
            items: [...ready.page.items, ...next.items],
            nextCursor: next.nextCursor,
          },
        }),
      )
      .catch(() => setError('More workouts could not be loaded.'));
  };

  return (
    <Screen
      contentContainerStyle={{ gap: spacing.xl }}
      testID="workout-history-screen"
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Workout History
        </AppText>
        <AppText color="secondary">
          Completed workouts and performed results saved on this device.
        </AppText>
        {hasDeletedWorkout ? (
          <AppText accessibilityLiveRegion="polite">
            {deletionConfirmedMessage}
          </AppText>
        ) : null}
      </View>
      <SelectionField
        label="Summary period"
        onChange={selectPeriod}
        options={[
          { label: 'Day', value: 'day' },
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
        ]}
        testID="workout-history-period"
        value={period}
      />
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="heading">
          {periodDetails.label}
        </AppText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
        >
          <AppButton
            accessibilityLabel={`Show previous ${period}`}
            label="Previous"
            onPress={() =>
              setAnchor(moveWorkoutHistoryPeriod(anchor, period, -1))
            }
            testID="workout-history-previous-period"
            variant="outline"
          />
          <AppButton
            accessibilityLabel={`Show next ${period}`}
            label="Next"
            onPress={() =>
              setAnchor(moveWorkoutHistoryPeriod(anchor, period, 1))
            }
            testID="workout-history-next-period"
            variant="outline"
          />
        </View>
      </View>
      <ProgressSummary summary={ready.summary} unitSystem={ready.unitSystem} />
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}
      <SectionHeader title="Recent workouts" />
      {ready.page.items.length === 0 ? (
        <EmptyState
          description="Finish a workout with at least one performed set to build your history."
          icon="time-outline"
          title="No completed workouts yet"
        />
      ) : (
        ready.page.items.map((item) => (
          <HistoryCard
            item={item}
            key={item.sessionId.value}
            onOpen={onOpenSession}
          />
        ))
      )}
      {ready.page.nextCursor ? (
        <AppButton
          label="Load More Workouts"
          onPress={loadMore}
          variant="outline"
        />
      ) : null}
      {ready.performedExercises.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Exercise progress" />
          {ready.performedExercises.map((item) => (
            <Card
              accessibilityLabel={`Open performance history for ${item.exerciseNameSnapshot}`}
              key={item.sourceExerciseDefinitionId.value}
              onPress={() =>
                onOpenExercise(item.sourceExerciseDefinitionId.value)
              }
              variant="outlined"
            >
              <AppText variant="heading">{item.exerciseNameSnapshot}</AppText>
              <AppText color="secondary">
                Review performed sessions and personal records
              </AppText>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function ProgressSummary({
  summary,
  unitSystem,
}: Readonly<{ summary: WorkoutProgressSummary; unitSystem: UnitSystem }>) {
  const distance =
    summary.distanceMillimeters === null
      ? null
      : formatRecordedDistance(summary.distanceMillimeters, unitSystem);
  const volume =
    summary.recordedLoadVolumeGramRepetitions === null
      ? null
      : formatRecordedLoadVolume(
          summary.recordedLoadVolumeGramRepetitions,
          unitSystem,
        );
  return (
    <Card accessibilityLabel="Workout progress summary" variant="elevated">
      <AppText variant="heading">Performed summary</AppText>
      <AppText>{summary.completedWorkoutCount} completed workouts</AppText>
      <AppText>{summary.actualSetCount} actual sets</AppText>
      <AppText>{summary.performedExerciseCount} performed exercises</AppText>
      <AppText>
        {formatDuration(summary.elapsedWorkoutSeconds)} workout time
      </AppText>
      {summary.repetitions !== null ? (
        <AppText>{summary.repetitions} repetitions</AppText>
      ) : null}
      {summary.durationSeconds !== null ? (
        <AppText>
          {formatDuration(summary.durationSeconds)} performed duration
        </AppText>
      ) : null}
      {distance ? <AppText>{distance} performed distance</AppText> : null}
      {volume ? <AppText>{volume} recorded load volume</AppText> : null}
    </Card>
  );
}

function HistoryCard({
  item,
  onOpen,
}: Readonly<{
  item: WorkoutHistoryListItem;
  onOpen: (id: string) => void;
}>) {
  const dateLabel = formatCapturedDate(item.startedLocalCalendarDate);
  return (
    <Card
      accessibilityLabel={`Open ${item.nameSnapshot}, ${dateLabel}, ${item.actualSetCount} actual sets, ${formatDuration(item.elapsedSeconds)}`}
      onPress={() => onOpen(item.sessionId.value)}
      testID="completed-workout-card"
      variant="outlined"
    >
      <AppText variant="heading">{item.nameSnapshot}</AppText>
      <AppText>{dateLabel}</AppText>
      <AppText color="secondary">
        {item.actualSetCount} actual sets · {item.performedExerciseCount}{' '}
        performed exercises
      </AppText>
      <AppText color="secondary">{formatDuration(item.elapsedSeconds)}</AppText>
    </Card>
  );
}
