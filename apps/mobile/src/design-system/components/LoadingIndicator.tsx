import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';
import { AppText } from './AppText';

type LoadingIndicatorProps = Readonly<{
  label?: string;
}>;

export function LoadingIndicator({ label = 'Loading' }: LoadingIndicatorProps) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={styles.container}
    >
      <ActivityIndicator
        accessibilityElementsHidden
        color={theme.colors.primary}
      />
      <AppText
        accessibilityElementsHidden
        color="secondary"
        variant="bodySmall"
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
