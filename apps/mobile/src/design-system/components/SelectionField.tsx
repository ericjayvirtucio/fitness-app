import { Pressable, StyleSheet, View } from 'react-native';
import {
  borderWidths,
  minimumTouchTarget,
  radii,
  spacing,
} from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';
import { AppText } from './AppText';

export type SelectionOption<TValue extends string> = Readonly<{
  label: string;
  value: TValue;
}>;

type SelectionFieldProps<TValue extends string> = Readonly<{
  error?: string | undefined;
  label: string;
  onChange: (value: TValue) => void;
  options: readonly SelectionOption<TValue>[];
  testID?: string;
  value?: TValue | undefined;
}>;

export function SelectionField<TValue extends string>({
  error,
  label,
  onChange,
  options,
  testID,
  value,
}: SelectionFieldProps<TValue>) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="radiogroup"
      style={styles.field}
      testID={testID}
    >
      <AppText variant="label">{label}</AppText>
      <View style={styles.options}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected
                    ? theme.colors.secondary
                    : theme.colors.surface,
                  borderColor: error
                    ? theme.colors.danger
                    : isSelected
                      ? theme.colors.primary
                      : theme.colors.border,
                },
              ]}
              testID={testID ? `${testID}-${option.value}` : undefined}
            >
              <AppText variant="label">{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          color="danger"
          variant="caption"
        >
          Error: {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  option: {
    borderRadius: radii.medium,
    borderWidth: borderWidths.thin,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
