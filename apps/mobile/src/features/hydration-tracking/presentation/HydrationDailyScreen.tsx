import type { DailyHydrationSummary, HydrationEntry } from '@fitness/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import { createHydrationTrackingUseCases } from '../../../composition/hydration-tracking';
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
  formatHydrationPercentage,
  formatHydrationTime,
  formatHydrationVolume,
} from './hydration-formatting';

type DailyResult = Readonly<{
  entries: readonly HydrationEntry[];
  summary: DailyHydrationSummary;
}>;
type UseCases = Readonly<{
  getDailyHydration: Readonly<{
    execute: (date: string) => Promise<DailyResult>;
  }>;
}>;
type State =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ result: DailyResult; status: 'ready' }>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onAdd: (localCalendarDate: string) => void;
  onEdit: (id: string) => void;
  onSetTarget: () => void;
}>;

export function HydrationDailyScreen({
  loadUseCases = createHydrationTrackingUseCases,
  onAdd,
  onEdit,
  onSetTarget,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfLocalDay(new Date()),
  );
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(() => {
    setState({ status: 'loading' });
    void loadUseCases()
      .then(async (useCases) => {
        const result = await useCases.getDailyHydration.execute(
          formatLocalCalendarDate(selectedDate),
        );
        setState({ result, status: 'ready' });
      })
      .catch(() => setState({ status: 'error' }));
  }, [loadUseCases, selectedDate]);
  useFocusEffect(load);

  const moveDay = (days: number) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return startOfLocalDay(next);
    });
  };

  if (state.status === 'loading') {
    return (
      <Screen accessibilityLabel="Loading hydration" hasTabBar isCentered>
        <LoadingIndicator label="Loading hydration" />
      </Screen>
    );
  }
  if (state.status === 'error') {
    return (
      <Screen accessibilityLabel="Hydration error" hasTabBar isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Hydration unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your fluid entries could not be loaded. Nothing was changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
      </Screen>
    );
  }

  const { entries, summary } = state.result;
  const selectedLocalCalendarDate = formatLocalCalendarDate(selectedDate);
  const today = formatLocalCalendarDate(new Date());
  const isToday = selectedLocalCalendarDate === today;
  /*
   * A recording screen may not offer a day that has not happened, because every
   * entry builder refuses a future instant. Stopping the navigator at today is
   * what keeps the add control below from offering an act the application will
   * decline.
   */
  const isNextDisabled = selectedLocalCalendarDate >= today;
  return (
    <Screen
      accessibilityLabel="Hydration"
      contentContainerStyle={{ gap: spacing.xl }}
      hasTabBar
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Hydration
        </AppText>
        <AppText color="secondary">
          Record explicit fluid volumes offline. Your target is a personal
          tracking choice, not medical advice.
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{formatDisplayDate(selectedDate)}</AppText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
        >
          <AppButton
            accessibilityLabel="Previous day"
            label="Previous"
            onPress={() => moveDay(-1)}
            variant="outline"
          />
          <AppButton
            label="Today"
            onPress={() => setSelectedDate(startOfLocalDay(new Date()))}
            variant="ghost"
          />
          <AppButton
            accessibilityLabel="Next day"
            disabled={isNextDisabled}
            label="Next"
            onPress={() => moveDay(1)}
            variant="outline"
          />
        </View>
      </View>

      <Card
        accessibilityLabel={`Daily fluid totals, total ${formatHydrationVolume(summary.totalFluidVolume)}, plain water ${formatHydrationVolume(summary.plainWaterVolume)}, other fluids ${formatHydrationVolume(summary.otherFluidVolume)}, ${summary.entryCount} ${summary.entryCount === 1 ? 'entry' : 'entries'}`}
        variant="outlined"
      >
        <AppText color="secondary" variant="label">
          Total fluid
        </AppText>
        <AppText variant="display">
          {formatHydrationVolume(summary.totalFluidVolume)}
        </AppText>
        <AppText>
          Plain water: {formatHydrationVolume(summary.plainWaterVolume)}
        </AppText>
        <AppText>
          Other fluids: {formatHydrationVolume(summary.otherFluidVolume)}
        </AppText>
        <AppText color="secondary">
          {summary.entryCount} {summary.entryCount === 1 ? 'entry' : 'entries'}
        </AppText>
      </Card>

      {isToday ? (
        summary.targetVolume &&
        summary.remainingVolume &&
        summary.completionPercentage !== null ? (
          /*
           * Deliberately unlabelled. A labelled card is one accessibility
           * element, so a name here hid "Change daily target" from the
           * accessibility tree entirely and left a person who had set a target
           * with no way to change it. The lines below and the control announce
           * themselves, which is what they say on screen anyway.
           */
          <Card variant="outlined">
            <AppText variant="heading">Daily fluid target</AppText>
            <AppText>
              {formatHydrationPercentage(summary.completionPercentage)} complete
            </AppText>
            <AppText>
              {summary.remainingVolume.milliliters === 0
                ? `Target reached · ${formatHydrationVolume(summary.totalFluidVolume)} logged`
                : `${formatHydrationVolume(summary.remainingVolume)} remaining of ${formatHydrationVolume(summary.targetVolume)}`}
            </AppText>
            <AppButton
              label="Change daily target"
              onPress={onSetTarget}
              variant="outline"
            />
          </Card>
        ) : (
          <Card variant="outlined">
            <AppText variant="heading">No daily target set</AppText>
            <AppText color="secondary">
              You can log fluids without a target or choose your own tracking
              target.
            </AppText>
            <AppButton label="Set daily target" onPress={onSetTarget} />
          </Card>
        )
      ) : (
        <AppText color="secondary">
          Historical days show recorded totals. Target progress is shown only
          for today because targets are not versioned.
        </AppText>
      )}

      <AppButton
        label="Add fluid"
        onPress={() => onAdd(selectedLocalCalendarDate)}
      />
      {entries.length === 0 ? (
        <EmptyState
          actionLabel="Add first fluid"
          description="Record water or another fluid using an explicit milliliter amount."
          icon="water-outline"
          onAction={() => onAdd(selectedLocalCalendarDate)}
          title="Nothing logged for this day"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Entries" />
          {entries.map((entry) => {
            const name =
              entry.fluidType === 'plain-water'
                ? 'Water'
                : (entry.description ?? 'Other fluid');
            return (
              <Card
                accessibilityLabel={`Edit ${name}, ${formatHydrationVolume(entry.volume)}, ${formatHydrationTime(entry.occurredAtEpochMilliseconds, entry.utcOffsetMinutes)}`}
                key={entry.id.value}
                onPress={() => onEdit(entry.id.value)}
                variant="outlined"
              >
                <AppText variant="heading">{name}</AppText>
                <AppText>{formatHydrationVolume(entry.volume)}</AppText>
                <AppText color="secondary">
                  {formatHydrationTime(
                    entry.occurredAtEpochMilliseconds,
                    entry.utcOffsetMinutes,
                  )}
                </AppText>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
