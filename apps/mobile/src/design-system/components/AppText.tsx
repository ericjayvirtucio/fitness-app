import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';
import { typography } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

export type TextVariant = keyof typeof typography;

type AppTextProps = ComponentProps<typeof Text> &
  Readonly<{
    color?: 'primary' | 'secondary' | 'disabled' | 'danger';
    variant?: TextVariant;
  }>;

export function AppText({
  color = 'primary',
  style,
  variant = 'body',
  ...props
}: AppTextProps) {
  const theme = useAppTheme();
  const textColor = {
    danger: theme.colors.danger,
    disabled: theme.colors.textDisabled,
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
  }[color];

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[styles.base, typography[variant], { color: textColor }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 1,
  },
});
