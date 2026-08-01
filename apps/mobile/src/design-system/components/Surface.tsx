import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

type SurfaceProps = ComponentProps<typeof View>;

export function Surface({ style, ...props }: SurfaceProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor: theme.colors.surface,
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
    borderRadius: radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});
