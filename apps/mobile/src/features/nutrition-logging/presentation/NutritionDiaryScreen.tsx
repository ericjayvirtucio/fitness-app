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

      <Card accessibilityLabel="Daily nutrition totals" variant="outlined">
        <AppText variant="heading">
          {formatNutritionEnergy(summary.energy)}
        </AppText>
        <AppText color="secondary">
          {summary.entryCount} {summary.entryCount === 1 ? 'entry' : 'entries'}
        </AppText>
        <View style={{ gap: spacing.xs }}>
          <AppText>
            Protein: {formatNutrient(summary.nutrients.proteinGrams, 'g')}
          </AppText>
          <AppText>
            Carbohydrate:{' '}
            {formatNutrient(summary.nutrients.carbohydrateGrams, 'g')}
          </AppText>
          <AppText>
            Fat: {formatNutrient(summary.nutrients.fatGrams, 'g')}
          </AppText>
          <AppText>
            Fiber: {formatNutrient(summary.nutrients.fiberGrams, 'g')}
          </AppText>
          <AppText>
            Sugar: {formatNutrient(summary.nutrients.sugarGrams, 'g')}
          </AppText>
          <AppText>
            Sodium: {formatNutrient(summary.nutrients.sodiumMilligrams, 'mg')}
          </AppText>
        </View>
        {Object.values(summary.nutrients).some((value) => value === null) ? (
          <AppText color="secondary">
            Incomplete means at least one entry has unknown information for that
            nutrient.
          </AppText>
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
