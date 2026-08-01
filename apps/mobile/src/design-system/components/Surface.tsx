import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { borderWidths, radii, spacing } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

type SurfaceProps = ComponentProps<typeof View> &
  Readonly<{ tone?: 'default' | 'variant' }>;

export function Surface({ tone = 'default', style, ...props }: SurfaceProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor:
            tone === 'variant'
              ? theme.colors.surfaceVariant
              : theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: radii.extraLarge,
    borderWidth: borderWidths.thin,
    padding: spacing.xl,
  },
});
