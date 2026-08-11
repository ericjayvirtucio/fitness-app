import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  AppIcon,
  AppText,
  borderWidths,
  minimumTouchTarget,
  radii,
  spacing,
  useAppTheme,
} from '../../../design-system';

type Props = Readonly<{
  isChecked: boolean;
  label: string;
  onChange: (isChecked: boolean) => void;
  testID?: string;
}>;

/**
 * The deliberate act that enables a destructive control.
 *
 * It lives here rather than in the design system because one screen needs it;
 * a shared component can be extracted when a second one does. The checkbox role
 * and checked state are what assistive technology needs, and the mark is never
 * the only signal — the label stays readable and the row keeps a visible border
 * either way, so the state is not carried by colour alone.
 */
export function IrreversibleActionAcknowledgement({
  isChecked,
  label,
  onChange,
  testID,
}: Props) {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      accessible
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={() => onChange(!isChecked)}
      style={[
        styles.row,
        {
          borderColor: isFocused ? theme.colors.focus : theme.colors.border,
          borderWidth: isFocused ? borderWidths.strong : borderWidths.thin,
        },
      ]}
      testID={testID}
    >
      <AppIcon
        color={isChecked ? theme.colors.primary : theme.colors.textSecondary}
        name={isChecked ? 'checkbox' : 'square-outline'}
      />
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderRadius: radii.medium,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: minimumTouchTarget,
    padding: spacing.md,
  },
});
