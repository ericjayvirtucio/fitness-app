import type { ErrorBoundaryProps } from 'expo-router';
import {
  AppButton,
  AppText,
  Screen,
  Surface,
  useAppTheme,
} from '../design-system';
import { spacing } from '../design-system/theme/tokens';

export function RouteErrorFallback({ retry }: ErrorBoundaryProps) {
  const theme = useAppTheme();

  return (
    <Screen accessibilityLabel="Application error">
      <Surface style={{ gap: spacing.md }}>
        <AppText accessibilityRole="header" variant="heading">
          Something went wrong
        </AppText>
        <AppText style={{ color: theme.colors.textSecondary }}>
          The app could not display this screen. Your information has not been
          changed.
        </AppText>
        <AppButton
          accessibilityLabel="Try loading the screen again"
          label="Try again"
          onPress={() => void retry()}
        />
      </Surface>
    </Screen>
  );
}
