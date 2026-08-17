import { useState } from 'react';
import { View } from 'react-native';
import {
  AppButton,
  AppText,
  SelectionField,
  spacing,
} from '../../../design-system';
import {
  isExerciseCatalogFilterActive,
  noExerciseCatalogFilter,
  toEquipmentFilter,
  toMuscleGroupFilter,
  type ExerciseCatalogFilter,
} from '../application/exercise-catalog-filter';
import {
  clearFiltersLabel,
  equipmentFilterLabel,
  exerciseFilterSummaryMessage,
  filtersControlAccessibilityLabel,
  filtersControlLabel,
  muscleFilterLabel,
} from './exercise-filter-messages';
import {
  anyFilterValue,
  equipmentFilterOptions,
  equipmentOptions,
  labelFor,
  muscleFilterOptions,
  muscleOptions,
  type EquipmentFilterValue,
  type MuscleFilterValue,
} from './exercise-options';

/**
 * The one place the catalog is narrowed, used by the Exercise Library and by
 * every Exercise Picker. It lives in the capability that owns the catalog rather
 * than in the design system, because it knows the equipment and muscle-group
 * vocabularies and the sentences the product says about them — product meaning
 * the design system deliberately does not hold.
 *
 * Twenty-five options are more than a screen of chips at default text and
 * nearly two screens at the largest accessible size, so they are put away by
 * default. What is put away is only the choosing: the chosen values stay on the
 * control's own label, and the summary and the clear action stay outside the
 * collapsed region entirely, so an active filter is never hidden by the control
 * that applied it.
 *
 * The toggle is rendered outside that region rather than inside it, so it is the
 * same node before and after a press and focus stays where the person left it.
 *
 * Expansion belongs to the control; the criteria belong to the screen. A screen
 * needs to know what is narrowed, never whether the options happen to be shown.
 */
export function ExerciseFilterControls({
  filter,
  hasQuery,
  matchCount,
  onChange,
  testIDPrefix,
}: Readonly<{
  filter: ExerciseCatalogFilter;
  hasQuery: boolean;
  matchCount: number;
  onChange: (filter: ExerciseCatalogFilter) => void;
  testIDPrefix: string;
}>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isNarrowed = isExerciseCatalogFilterActive(filter);
  const labels = [
    filter.equipment === null
      ? null
      : labelFor(equipmentOptions, filter.equipment),
    filter.primaryMuscleGroup === null
      ? null
      : labelFor(muscleOptions, filter.primaryMuscleGroup),
  ].filter((label): label is string => label !== null);

  return (
    <View style={{ gap: spacing.md }}>
      {/*
       * `accessibilityState` is stated in full because `AppButton` composes its
       * own and a partial one would replace it. This control is never loading
       * and never disabled, so naming both is honest rather than defensive.
       */}
      <AppButton
        accessibilityLabel={filtersControlAccessibilityLabel(
          isExpanded,
          labels,
          matchCount,
          hasQuery,
        )}
        accessibilityState={{
          busy: false,
          disabled: false,
          expanded: isExpanded,
        }}
        label={filtersControlLabel(labels)}
        onPress={() => setIsExpanded((current) => !current)}
        testID={`${testIDPrefix}-filters-toggle`}
        variant="outline"
      />
      {isExpanded ? (
        <>
          <SelectionField
            label={equipmentFilterLabel}
            onChange={(value: EquipmentFilterValue) =>
              onChange({
                ...filter,
                equipment:
                  value === anyFilterValue ? null : toEquipmentFilter(value),
              })
            }
            options={equipmentFilterOptions}
            testID={`${testIDPrefix}-equipment-filter`}
            value={filter.equipment ?? anyFilterValue}
          />
          <SelectionField
            label={muscleFilterLabel}
            onChange={(value: MuscleFilterValue) =>
              onChange({
                ...filter,
                primaryMuscleGroup:
                  value === anyFilterValue ? null : toMuscleGroupFilter(value),
              })
            }
            options={muscleFilterOptions}
            testID={`${testIDPrefix}-muscle-filter`}
            value={filter.primaryMuscleGroup ?? anyFilterValue}
          />
        </>
      ) : null}
      {isNarrowed ? (
        <>
          <AppText
            accessibilityLiveRegion="polite"
            color="secondary"
            testID={`${testIDPrefix}-filter-summary`}
          >
            {exerciseFilterSummaryMessage(labels, matchCount, hasQuery)}
          </AppText>
          <AppButton
            label={clearFiltersLabel}
            onPress={() => onChange(noExerciseCatalogFilter)}
            variant="outline"
          />
        </>
      ) : null}
    </View>
  );
}
