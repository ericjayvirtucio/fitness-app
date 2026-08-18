import type { ConsumptionEntry, DailyNutritionSummary } from '@fitness/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import { createNutritionLoggingUseCases } from '../../../composition/nutrition-logging';
import {
  AppButton,
  AppText,
  Card,
  describeCardContents,
  EmptyState,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import {
  formatEntryTime,
  formatNutrient,
  formatNutritionEnergy,
} from './nutrition-formatting';

type DailyResult = Readonly<{
  entries: readonly ConsumptionEntry[];
  summary: DailyNutritionSummary;
}>;
type UseCases = Readonly<{
  getDailyNutrition: Readonly<{
    execute: (date: string) => Promise<DailyResult>;
  }>;
}>;
type State =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ result: DailyResult; status: 'ready' }>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onAdd: () => void;
  onEdit: (id: string) => void;
}>;

export function NutritionDiaryScreen({
  loadUseCases = createNutritionLoggingUseCases,
  onAdd,
  onEdit,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfLocalDay(new Date()),
  );
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    void loadUseCases()
      .then(async (useCases) => {
        const result = await useCases.getDailyNutrition.execute(
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
      <Screen accessibilityLabel="Loading nutrition diary" isCentered>
        <LoadingIndicator label="Loading nutrition diary" />
      </Screen>
    );
  }
  if (state.status === 'error') {
    return (
      <Screen accessibilityLabel="Nutrition diary error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Nutrition unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your entries could not be loaded. Nothing was changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
      </Screen>
    );
  }

  const { entries, summary } = state.result;
  /**
   * Every total the card states, in the order it reads them. A labelled card is
   * one accessibility element, so its own name is the only thing announced;
   * composing the lines and the name from one list is what keeps a day's totals
   * audible rather than hidden behind the card's title.
   */
  const energyLine = formatNutritionEnergy(summary.energy);
  const entryCountLine = `${summary.entryCount} ${
    summary.entryCount === 1 ? 'entry' : 'entries'
  }`;
  const nutrientLines = [
    `Protein: ${formatNutrient(summary.nutrients.proteinGrams, 'g')}`,
    `Carbohydrate: ${formatNutrient(summary.nutrients.carbohydrateGrams, 'g')}`,
    `Fat: ${formatNutrient(summary.nutrients.fatGrams, 'g')}`,
    `Fiber: ${formatNutrient(summary.nutrients.fiberGrams, 'g')}`,
    `Sugar: ${formatNutrient(summary.nutrients.sugarGrams, 'g')}`,
    `Sodium: ${formatNutrient(summary.nutrients.sodiumMilligrams, 'mg')}`,
  ];
  const incompleteExplanation = Object.values(summary.nutrients).some(
    (value) => value === null,
  )
    ? 'Incomplete means at least one entry has unknown information for that nutrient.'
    : undefined;
  const totalsLines = [
    energyLine,
    entryCountLine,
    ...nutrientLines,
    ...(incompleteExplanation ? [incompleteExplanation] : []),
  ];
  return (
    <Screen
      accessibilityLabel="Nutrition diary"
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Nutrition
        </AppText>
        <AppText color="secondary">
          Food and caloric beverage entries stay available offline on this
          device.
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
            label="Next"
            onPress={() => moveDay(1)}
            variant="outline"
          />
        </View>
      </View>

      <Card
        accessibilityLabel={describeCardContents(
          'Daily nutrition totals',
          totalsLines,
        )}
        variant="outlined"
      >
        <AppText variant="heading">{energyLine}</AppText>
        <AppText color="secondary">{entryCountLine}</AppText>
        <View style={{ gap: spacing.xs }}>
          {nutrientLines.map((line) => (
            <AppText key={line}>{line}</AppText>
          ))}
        </View>
        {incompleteExplanation ? (
          <AppText color="secondary">{incompleteExplanation}</AppText>
        ) : null}
      </Card>

      <AppButton label="Add food or beverage" onPress={onAdd} />
      {entries.length === 0 ? (
        <EmptyState
          actionLabel="Add first entry"
          description="Record food or a caloric beverage using grams or milliliters."
          icon="nutrition-outline"
          onAction={onAdd}
          title="Nothing logged for this day"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Entries" />
          {entries.map((entry) => (
            <Card
              accessibilityLabel={`Edit ${entry.kind} entry, ${entry.facts.description}, ${formatNutritionEnergy(entry.consumedFacts.energy)}, ${formatEntryTime(entry.occurredAtEpochMilliseconds, entry.utcOffsetMinutes)}`}
              key={entry.id.value}
              onPress={() => onEdit(entry.id.value)}
              variant="outlined"
            >
              <AppText variant="heading">{entry.facts.description}</AppText>
              <AppText color="secondary">
                {entry.kind === 'food' ? 'Food' : 'Beverage'} ·{' '}
                {formatEntryTime(
                  entry.occurredAtEpochMilliseconds,
                  entry.utcOffsetMinutes,
                )}
              </AppText>
              <AppText>
                {formatNutritionEnergy(entry.consumedFacts.energy)}
              </AppText>
            </Card>
          ))}
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
