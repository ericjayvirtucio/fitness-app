import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { UnitSystem } from '@fitness/domain';
import { createWorkoutHistoryUseCases } from '../../../composition/workout-history';
import {
  AppButton,
  AppText,
  Card,
  EmptyState,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import type {
  ExercisePerformanceItem,
  ExercisePerformancePage,
} from '../application/workout-history-models';
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
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [useCases, setUseCases] = useState<UseCases>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    void loadUseCases()
      .then(async (loaded) => {
        const [history, profile] = await Promise.all([
          loaded.listExercisePerformance.execute(exerciseDefinitionId),
          loaded.getProfile.execute(),
        ]);
        setUseCases(loaded);
        setPage(history ?? { items: [], nextCursor: null });
        setUnitSystem(profile?.preferredUnitSystem ?? 'metric');
      })
      .catch(() => setError('Exercise performance could not be loaded.'));
  }, [exerciseDefinitionId, loadUseCases]);
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

  const name = page.items[0]?.exerciseNameSnapshot ?? 'Exercise performance';
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
        page.items.map((item, index) => (
          <PerformanceCard
            item={item}
            key={`${item.sessionId.value}-${item.startedAtEpochMilliseconds}-${index}`}
            onOpenSession={onOpenSession}
            unitSystem={unitSystem}
          />
        ))
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
      `${item.maximumResistanceGrams / (unitSystem === 'metric' ? 1_000 : 453.59237)} ${unitSystem === 'metric' ? 'kg' : 'lb'} maximum ${item.loggingModeSnapshot === 'assistance-and-repetitions' ? 'assistance' : 'resistance'}`,
    );
  if (item.durationSeconds !== null)
    values.push(`${formatDuration(item.durationSeconds)} duration`);
  if (item.distanceMillimeters !== null)
    values.push(
      `${item.distanceMillimeters / (unitSystem === 'metric' ? 1_000_000 : 1_609_344)} ${unitSystem === 'metric' ? 'km' : 'mi'} distance`,
    );
  if (item.recordedLoadVolumeGramRepetitions !== null)
    values.push(
      `${item.recordedLoadVolumeGramRepetitions / (unitSystem === 'metric' ? 1_000 : 453.59237)} ${unitSystem === 'metric' ? 'kg-reps' : 'lb-reps'} recorded load volume`,
    );
  return values;
}
