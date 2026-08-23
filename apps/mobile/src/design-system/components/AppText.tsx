import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';
import { typography } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

export type TextVariant = keyof typeof typography;

type AppTextProps = ComponentProps<typeof Text> &
  Readonly<{
    color?: 'accent' | 'primary' | 'secondary' | 'disabled' | 'danger';
    /**
     * Keep the text on one line, shrinking it rather than wrapping or clipping.
     *
     * Dynamic Type doubles every size here, so a `hero` numeral reaches 112px and
     * no card is wide enough to hold it. React Native neither shrinks nor wraps
     * by default in a way that keeps a number readable, so a hero value opts in
     * and a sentence never does — shrinking prose to fit is how a paragraph
     * becomes unreadable at exactly the setting that asked for larger text.
     */
    isSingleLine?: boolean;
    variant?: TextVariant;
  }>;

/** Half the resolved size, which keeps 112px legible inside a padded card. */
const minimumShrinkScale = 0.5;

export function AppText({
  color = 'primary',
  isSingleLine = false,
  style,
  variant = 'body',
  ...props
}: AppTextProps) {
  const theme = useAppTheme();
  const textColor = {
    accent: theme.colors.primary,
    danger: theme.colors.danger,
    disabled: theme.colors.textDisabled,
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
  }[color];

  return (
    <Text
      adjustsFontSizeToFit={isSingleLine}
      allowFontScaling
      maxFontSizeMultiplier={2}
      minimumFontScale={isSingleLine ? minimumShrinkScale : undefined}
      numberOfLines={isSingleLine ? 1 : undefined}
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
