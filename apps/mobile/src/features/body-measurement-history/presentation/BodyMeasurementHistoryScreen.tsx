import type { BodyWeightEntry, UserProfile } from '@fitness/domain';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { createBodyMeasurementHistoryUseCases } from '../../../composition/body-measurement-history';
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
import type {
  BodyWeightHistoryCursor,
  BodyWeightHistoryPage,
} from '../application/body-weight-history-models';
import {
  describeBodyWeightEntry,
  formatBodyWeight,
  formatMeasurementDate,
  formatMeasurementTime,
  getBodyWeightDisplayUnit,
  type BodyWeightDisplayUnit,
} from './body-weight-formatting';

type UseCases = Readonly<{
  getProfile: Readonly<{ execute: () => Promise<UserProfile | null> }>;
  listHistory: Readonly<{
    execute: (query?: {
      cursor?: BodyWeightHistoryCursor;
    }) => Promise<BodyWeightHistoryPage>;
  }>;
}>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onAddCheckIn: () => void;
  onOpenEntry: (id: string) => void;
}>;

type ScreenState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{
      entries: readonly BodyWeightEntry[];
      nextCursor: BodyWeightHistoryCursor | null;
      status: 'ready';
      unit: BodyWeightDisplayUnit;
    }>;

export function BodyMeasurementHistoryScreen({
  loadUseCases = createBodyMeasurementHistoryUseCases,
  onAddCheckIn,
  onOpenEntry,
}: Props) {
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const requestSequence = useRef(0);

  const load = useCallback(() => {
    const request = ++requestSequence.current;
    void loadUseCases()
      .then(async (useCases) => {
        const [profile, page] = await Promise.all([
          useCases.getProfile.execute(),
          useCases.listHistory.execute(),
        ]);
        if (request !== requestSequence.current) return;
        setState({
          entries: page.items,
          nextCursor: page.nextCursor,
          status: 'ready',
          unit: getBodyWeightDisplayUnit(profile?.preferredUnitSystem),
        });
      })
      .catch(() => {
        if (request === requestSequence.current) setState({ status: 'error' });
      });
  }, [loadUseCases]);

  useFocusEffect(load);

  const loadMore = () => {
    if (state.status !== 'ready' || state.nextCursor === null) return;
    const cursor = state.nextCursor;
    setIsLoadingMore(true);
    void loadUseCases()
      .then((useCases) => useCases.listHistory.execute({ cursor }))
      .then((page) =>
        setState((current) =>
          current.status === 'ready'
            ? {
                ...current,
                entries: [...current.entries, ...page.items],
                nextCursor: page.nextCursor,
              }
            : current,
        ),
      )
      .catch(() => setState({ status: 'error' }))
      .finally(() => setIsLoadingMore(false));
  };

  if (state.status === 'loading')
    return (
      <Screen accessibilityLabel="Loading body measurements" isCentered>
        <LoadingIndicator label="Loading body measurements" />
      </Screen>
    );

  if (state.status === 'error')
    return (
      <Screen accessibilityLabel="Body measurements error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Body measurements unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your measurements could not be read from this device. Nothing was
          changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
      </Screen>
    );

  return (
    <Screen
      contentContainerStyle={{ gap: spacing.xl }}
      testID="body-measurements-screen"
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Body measurements
        </AppText>
        <AppText color="secondary">
          Recorded weight check-ins stay on this device. Your profile keeps only
          your current weight.
        </AppText>
      </View>
      <AppButton
        label="Add weight check-in"
        onPress={onAddCheckIn}
        testID="add-body-weight"
      />
      {state.entries.length === 0 ? (
        <EmptyState
          description="Record a weight check-in to start a history you can review later."
          icon="trending-up-outline"
          title="No weight check-ins yet"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <SectionHeader subtitle="Most recent first" title="Weight history" />
          {state.entries.map((entry) => (
            <CheckInCard
              entry={entry}
              key={entry.id.value}
              onPress={() => onOpenEntry(entry.id.value)}
              unit={state.unit}
            />
          ))}
          {state.nextCursor ? (
            <AppButton
              isLoading={isLoadingMore}
              label="Show older check-ins"
              onPress={loadMore}
              testID="load-older-body-weight"
              variant="outline"
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function CheckInCard({
  entry,
  onPress,
  unit,
}: Readonly<{
  entry: BodyWeightEntry;
  onPress: () => void;
  unit: BodyWeightDisplayUnit;
}>) {
  return (
    <Card
      accessibilityLabel={describeBodyWeightEntry(entry, unit)}
      onPress={onPress}
      testID={`body-weight-entry-${entry.id.value}`}
      variant="outlined"
    >
      <AppText variant="heading">
        {formatBodyWeight(entry.mass.grams, unit)}
      </AppText>
      <AppText color="secondary" variant="bodySmall">
        {formatMeasurementDate(entry.localCalendarDate)} ·{' '}
        {formatMeasurementTime(entry)}
      </AppText>
      {entry.note ? (
        <AppText color="secondary" variant="bodySmall">
          {entry.note}
        </AppText>
      ) : null}
    </Card>
  );
}
