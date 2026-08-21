import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { createProgressAnalyticsUseCases } from '../../../composition/progress-analytics';
import {
  formatLocalCalendarDate,
  getCalendarPeriodDetails,
  moveCalendarPeriod,
  type CalendarPeriod,
} from '../../../application/date/local-calendar-date';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SectionHeader,
  SelectionField,
  spacing,
} from '../../../design-system';
import {
  formatBodyWeight,
  formatBodyWeightChange,
  getBodyWeightDisplayUnit,
} from '../../body-measurement-history/presentation/body-weight-formatting';
import type {
  ProgressDay,
  ProgressSummary,
} from '../application/progress-models';
import {
  formatProgressDate,
  formatProgressEnergy,
  formatProgressMass,
  formatProgressVolume,
} from './progress-formatting';
import { formatDuration } from '../../workout-session/presentation/workout-result-formatting';

type UseCases = Awaited<ReturnType<typeof createProgressAnalyticsUseCases>>;

export function ProgressScreen({
  loadUseCases = createProgressAnalyticsUseCases,
}: Readonly<{ loadUseCases?: () => Promise<UseCases> }>) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [period, setPeriod] = useState<CalendarPeriod>('week');
  const [summary, setSummary] = useState<ProgressSummary>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const requestSequence = useRef(0);
  const details = getCalendarPeriodDetails(anchor, period);

  const load = useCallback(() => {
    const request = ++requestSequence.current;
    setIsLoading(true);
    setError(undefined);
    void loadUseCases()
      .then((useCases) => useCases.getSummary.execute(details.range))
      .then((nextSummary) => {
        if (request === requestSequence.current) setSummary(nextSummary);
      })
      .catch(() => {
        if (request === requestSequence.current)
          setError('Progress could not be loaded from this device.');
      })
      .finally(() => {
        if (request === requestSequence.current) setIsLoading(false);
      });
  }, [
    details.range.endLocalCalendarDate,
    details.range.startLocalCalendarDate,
    loadUseCases,
  ]);
  useFocusEffect(load);

  const selectPeriod = (value: CalendarPeriod) => {
    setPeriod(value);
    setAnchor(new Date());
  };

  if (isLoading && !summary)
    return (
      <Screen accessibilityLabel="Loading progress" hasTabBar isCentered>
        <LoadingIndicator label="Loading progress" />
      </Screen>
    );
  if (!summary)
    return (
      <Screen accessibilityLabel="Progress error" hasTabBar isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Progress unavailable
        </AppText>
        <AppText color="secondary">{error}</AppText>
        <AppButton label="Try Again" onPress={load} />
      </Screen>
    );

  const isNextDisabled =
    details.range.endLocalCalendarDate >= formatLocalCalendarDate(new Date());
  return (
    <Screen
      contentContainerStyle={{ gap: spacing.xl }}
      hasTabBar
      testID="progress-screen"
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Progress
        </AppText>
        <AppText color="secondary">
          A private, offline summary of what you recorded.
        </AppText>
      </View>
      <SelectionField
        label="Progress period"
        onChange={selectPeriod}
        options={[
          { label: 'Today', value: 'day' },
          { label: 'This Week', value: 'week' },
          { label: 'This Month', value: 'month' },
        ]}
        testID="progress-period"
        value={period}
      />
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="heading">
          {details.label}
        </AppText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
        >
          <AppButton
            accessibilityLabel={`Show previous ${period}`}
            label="Previous"
            onPress={() => setAnchor(moveCalendarPeriod(anchor, period, -1))}
            testID="progress-previous-period"
            variant="outline"
          />
          <AppButton
            accessibilityLabel={`Show next ${period}`}
            disabled={isNextDisabled}
            label="Next"
            onPress={() => setAnchor(moveCalendarPeriod(anchor, period, 1))}
            testID="progress-next-period"
            variant="outline"
          />
        </View>
      </View>
      {isLoading ? <LoadingIndicator label="Updating progress" /> : null}
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}
      <NutritionSummary summary={summary} />
      <HydrationSummary summary={summary} />
      <WorkoutSummary summary={summary} />
      <BodyWeightSummary summary={summary} />
      {period !== 'day' ? (
        <DailyActivity days={summary.days} period={period} />
      ) : null}
    </Screen>
  );
}

function NutritionSummary({ summary }: Readonly<{ summary: ProgressSummary }>) {
  const value = summary.nutrition;
  // An unknown nutrient total is what incompleteness looks like on this model,
  // so the sentence below is conditioned on the absence itself.
  const hasIncompleteNutrient = [
    value.protein,
    value.carbohydrate,
    value.fat,
  ].some((item) => item.totalGrams === null);
  return (
    <Card variant="elevated">
      <SectionHeader title="Nutrition" />
      {value.loggedDayCount === 0 ? (
        <AppText color="secondary">No nutrition logged in this period.</AppText>
      ) : (
        <>
          <Metric
            label="Energy"
            value={formatProgressEnergy(value.energyKilojoules)}
          />
          <Metric
            label="Average per logged day"
            value={formatProgressEnergy(
              value.averageEnergyKilojoulesPerLoggedDay ?? 0,
            )}
          />
          <Metric label="Logged days" value={String(value.loggedDayCount)} />
          <Metric label="Entries" value={String(value.entryCount)} />
          <Metric
            label="Protein"
            value={formatProgressMass(value.protein.totalGrams)}
          />
          <Metric
            label="Carbohydrate"
            value={formatProgressMass(value.carbohydrate.totalGrams)}
          />
          <Metric
            label="Fat"
            value={formatProgressMass(value.fat.totalGrams)}
          />
          {hasIncompleteNutrient ? (
            <AppText color="secondary" variant="bodySmall">
              Incomplete means one or more entries did not include that
              nutrient.
            </AppText>
          ) : null}
        </>
      )}
    </Card>
  );
}

function HydrationSummary({ summary }: Readonly<{ summary: ProgressSummary }>) {
  const value = summary.hydration;
  return (
    <Card variant="outlined">
      <SectionHeader title="Hydration" />
      {value.loggedDayCount === 0 ? (
        <AppText color="secondary">No hydration logged in this period.</AppText>
      ) : (
        <>
          <Metric
            label="Total fluid"
            value={formatProgressVolume(value.totalFluidMilliliters)}
          />
          <Metric
            label="Plain water"
            value={formatProgressVolume(value.plainWaterMilliliters)}
          />
          <Metric
            label="Average per logged day"
            value={formatProgressVolume(
              value.averageFluidMillilitersPerLoggedDay ?? 0,
            )}
          />
          <Metric label="Logged days" value={String(value.loggedDayCount)} />
          <Metric label="Entries" value={String(value.entryCount)} />
        </>
      )}
    </Card>
  );
}

function WorkoutSummary({ summary }: Readonly<{ summary: ProgressSummary }>) {
  const value = summary.workout;
  return (
    <Card variant="outlined">
      <SectionHeader title="Workouts" />
      {value.completedWorkoutCount === 0 ? (
        <AppText color="secondary">
          No completed workouts in this period.
        </AppText>
      ) : (
        <>
          <Metric
            label="Completed workouts"
            value={String(value.completedWorkoutCount)}
          />
          <Metric label="Actual sets" value={String(value.actualSetCount)} />
          <Metric
            label="Performed exercises"
            value={String(value.performedExerciseCount)}
          />
          <Metric
            label="Workout time"
            value={formatDuration(value.elapsedWorkoutSeconds)}
          />
          {value.repetitions === null ? null : (
            <Metric label="Repetitions" value={String(value.repetitions)} />
          )}
        </>
      )}
    </Card>
  );
}

function BodyWeightSummary({
  summary,
}: Readonly<{ summary: ProgressSummary }>) {
  const value = summary.bodyWeight;
  const unit = getBodyWeightDisplayUnit(summary.preferredUnitSystem);
  if (value === null)
    return (
      <Card testID="progress-body-weight" variant="outlined">
        <SectionHeader title="Body weight" />
        <AppText color="secondary">No weight check-ins in this period.</AppText>
      </Card>
    );

  // The card itself stays non-accessible so each metric remains individually
  // navigable, matching the other Progress cards. The closing caption carries
  // the combined spoken summary.
  return (
    <Card testID="progress-body-weight" variant="outlined">
      <SectionHeader title="Body weight" />
      <Metric
        label="First recorded"
        value={formatBodyWeight(value.firstGrams, unit)}
      />
      <Metric
        label="Latest recorded"
        value={formatBodyWeight(value.latestGrams, unit)}
      />
      {value.changeGrams === null ? null : (
        <Metric
          label="Recorded change"
          value={formatBodyWeightChange(value.changeGrams, unit)}
        />
      )}
      <Metric label="Check-ins" value={String(value.entryCount)} />
      {/*
       * The caption announces the sentence it displays. Each metric above is its
       * own accessibility element and has already been spoken, so a composed
       * summary here repeated them in different words than the screen shows.
       */}
      <AppText color="secondary" variant="bodySmall">
        {value.changeGrams === null
          ? 'A recorded change needs at least two check-ins in this period.'
          : 'This is the difference between your first and latest recorded check-ins, not a measured trend.'}
      </AppText>
    </Card>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'space-between',
      }}
    >
      <AppText color="secondary">{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

function DailyActivity({
  days,
  period,
}: Readonly<{ days: readonly ProgressDay[]; period: CalendarPeriod }>) {
  const visibleDays = period === 'month' ? days.filter(hasActivity) : days;
  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader
        title="Daily activity"
        subtitle={
          period === 'month'
            ? 'Recorded days in this month'
            : 'Sunday through Saturday'
        }
      />
      {visibleDays.length === 0 ? (
        <AppText color="secondary">
          No activity recorded in this period.
        </AppText>
      ) : (
        visibleDays.map((day) => (
          <DailyRow day={day} key={day.localCalendarDate} />
        ))
      )}
    </View>
  );
}

function DailyRow({ day }: Readonly<{ day: ProgressDay }>) {
  const details = [
    day.nutrition
      ? `${formatProgressEnergy(day.nutrition.energyKilojoules)} nutrition`
      : 'no nutrition',
    day.hydration
      ? `${formatProgressVolume(day.hydration.totalFluidMilliliters)} fluid`
      : 'no hydration',
    day.workout
      ? `${day.workout.completedWorkoutCount} completed workouts`
      : 'no completed workouts',
  ];
  return (
    <Card
      accessibilityLabel={`${formatProgressDate(day.localCalendarDate)}: ${details.join(', ')}`}
      variant="outlined"
    >
      <AppText variant="subtitle">
        {formatProgressDate(day.localCalendarDate)}
      </AppText>
      <AppText color="secondary" variant="bodySmall">
        {details.join(' · ')}
      </AppText>
    </Card>
  );
}

function hasActivity(day: ProgressDay): boolean {
  return (
    day.nutrition !== null || day.hydration !== null || day.workout !== null
  );
}
