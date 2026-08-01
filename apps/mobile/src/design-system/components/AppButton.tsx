import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { minimumTouchTarget, radii, spacing } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';
import { AppText } from './AppText';

type AppButtonProps = Omit<
  ComponentProps<typeof Pressable>,
  'accessibilityRole' | 'children'
> &
  Readonly<{ label: string }>;

export function AppButton({
  disabled,
  label,
  style,
  ...props
}: AppButtonProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.primary,
          opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      <AppText style={{ color: theme.colors.onPrimary }} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.round,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
