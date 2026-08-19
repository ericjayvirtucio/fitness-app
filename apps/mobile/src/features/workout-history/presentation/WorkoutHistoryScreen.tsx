import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import type { UnitSystem } from '@fitness/domain';
import { createWorkoutHistoryUseCases } from '../../../composition/workout-history';
import {
  AppButton,
  AppText,
  Card,
  describeCardContents,
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
  WorkoutHistoryRange,
  WorkoutProgressSummary,
} from '../application/workout-history-models';
import {
  getWorkoutHistoryPeriodDetails,
  moveWorkoutHistoryPeriod,
  type WorkoutHistoryPeriod,
} from './workout-history-period';
import { deletionConfirmedMessage } from './completed-workout-deletion-messages';
import {
  absentRecordedLoadVolumeMessage,
  formatCapturedDate,
  formatRecordedDistance,
  formatRecordedLoadVolumeSummary,
} from './workout-history-formatting';
import { formatDuration } from '../../workout-session/presentation/workout-result-formatting';

type UseCases = Awaited<ReturnType<typeof createWorkoutHistoryUseCases>>;
/**
 * The range is stored beside the page it produced, not read from the current
 * selection, so a `Load More Workouts` press extends the period on screen even
 * if the selection has already moved on. The reload a selection change triggers
 * replaces the whole page moments later.
 *
 * `hasAnyCompletedWorkout` comes from one unbounded page of one workout,
 * because an empty period and an empty history need different sentences and a
 * bounded page cannot tell them apart. The performed exercises cannot answer it
 * either: a completed workout that recorded no set is history without being a
 * performed exercise.
 */
type ReadyState = Readonly<{
  hasAnyCompletedWorkout: boolean;
  page: WorkoutHistoryPage;
  performedExercises: readonly PerformedExerciseSummary[];
  range: WorkoutHistoryRange;
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
  const requestSequence = useRef(0);
  const periodDetails = getWorkoutHistoryPeriodDetails(anchor, period);

  /**
   * Only the newest read may write what the screen shows. Moving through
   * periods quickly starts one read per period, and a slower earlier one
   * finishing last would leave one period's summary above another period's
   * workouts — the disagreement the period-bounded list exists to prevent.
   */
  const load = useCallback(() => {
    const request = ++requestSequence.current;
    setIsLoading(true);
    setError(undefined);
    void loadUseCases()
      .then(async (useCases) => {
        const range = periodDetails.range;
        const [page, summary, profile, performedExercises, anyHistory] =
          await Promise.all([
            useCases.list.execute({ range }),
            useCases.getSummary.execute(range),
            useCases.getProfile.execute(),
            useCases.listPerformedExercises.execute(),
            useCases.list.execute({ limit: 1 }),
          ]);
        if (request !== requestSequence.current) return;
        setReady({
          hasAnyCompletedWorkout: anyHistory.items.length > 0,
          page,
          performedExercises,
          range,
          summary,
          unitSystem: profile?.preferredUnitSystem ?? 'metric',
          useCases,
        });
      })
      .catch(() => {
        if (request === requestSequence.current)
          setError('Workout history could not be loaded.');
      })
      .finally(() => {
        if (request === requestSequence.current) setIsLoading(false);
      });
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
      .execute({ cursor: ready.page.nextCursor, range: ready.range })
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
          description={
            ready.hasAnyCompletedWorkout
              ? 'Choose another period, or finish a workout to add one here.'
              : 'Finish a workout with at least one performed set to build your history.'
          }
          icon="time-outline"
          title={
            ready.hasAnyCompletedWorkout
              ? 'No workouts in this period'
              : 'No completed workouts yet'
          }
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
  const sentences = summarySentences(summary, unitSystem);
  return (
    <Card
      accessibilityLabel={describeCardContents(
        'Workout progress summary',
        sentences,
      )}
      variant="elevated"
    >
      <AppText variant="heading">Performed summary</AppText>
      {sentences.map((sentence) => (
        <AppText key={sentence}>{sentence}</AppText>
      ))}
    </Card>
  );
}

/**
 * Every total the card states, in the order it reads them.
 *
 * A labelled card is one accessible element, so its children never reach the
 * accessibility tree and its own name is the only thing announced. Composing the
 * lines and the name from one list is what keeps the announced summary identical
 * to the read one, rather than a name that describes numbers nobody hears.
 *
 * Every total here covers all recorded work of its own dimension except recorded
 * load volume, which sums external and added load alone and therefore says so.
 * It is stated in both directions — the covered sentence and the absent one — so
 * a period that recorded work always accounts for the dimension, and so the
 * card's height stops depending on what was recorded. Nothing is said at all
 * when nothing was recorded, because the completed workout count already says
 * that.
 */
function summarySentences(
  summary: WorkoutProgressSummary,
  unitSystem: UnitSystem,
): readonly string[] {
  const sentences = [
    `${summary.completedWorkoutCount} completed workouts`,
    `${summary.actualSetCount} actual sets`,
    `${summary.performedExerciseCount} performed exercises`,
    `${formatDuration(summary.elapsedWorkoutSeconds)} workout time`,
  ];
  if (summary.repetitions !== null)
    sentences.push(`${summary.repetitions} repetitions`);
  if (summary.durationSeconds !== null)
    sentences.push(
      `${formatDuration(summary.durationSeconds)} performed duration`,
    );
  if (summary.distanceMillimeters !== null)
    sentences.push(
      `${formatRecordedDistance(summary.distanceMillimeters, unitSystem)} performed distance`,
    );
  if (summary.recordedLoadVolumeGramRepetitions !== null)
    sentences.push(
      formatRecordedLoadVolumeSummary(
        summary.recordedLoadVolumeGramRepetitions,
        unitSystem,
      ),
    );
  else if (summary.actualSetCount > 0)
    sentences.push(absentRecordedLoadVolumeMessage);
  return sentences;
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
