import type { ErrorBoundaryProps } from 'expo-router';
import { AppButton, AppText, Screen, spacing, Surface } from '../design-system';

export function RouteErrorFallback({ retry }: ErrorBoundaryProps) {
  return (
    <Screen accessibilityLabel="Application error" isCentered>
      <Surface style={{ gap: spacing.md }}>
        <AppText accessibilityRole="header" variant="heading">
          Something went wrong
        </AppText>
        <AppText color="secondary">
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
