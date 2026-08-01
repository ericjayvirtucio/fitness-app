import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';
import { typography } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

type TextVariant = 'body' | 'bodySmall' | 'heading' | 'label';

type AppTextProps = ComponentProps<typeof Text> &
  Readonly<{ variant?: TextVariant }>;

export function AppText({ style, variant = 'body', ...props }: AppTextProps) {
  const theme = useAppTheme();

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[
        styles.base,
        styles[variant],
        { color: theme.colors.textPrimary },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 1,
  },
  body: {
    ...typography.body,
  },
  bodySmall: {
    ...typography.bodySmall,
  },
  heading: {
    ...typography.heading,
  },
  label: {
    ...typography.label,
  },
});
