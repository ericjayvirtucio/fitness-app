import { Link } from 'expo-router';
import { AppText, Screen, spacing, Surface } from '../src/design-system';

export default function NotFoundScreen() {
  return (
    <Screen accessibilityLabel="Page not found" isCentered>
      <Surface style={{ gap: spacing.md }}>
        <AppText accessibilityRole="header" variant="heading">
          Page not found
        </AppText>
        <AppText color="secondary">This destination is not available.</AppText>
        <Link accessibilityLabel="Return to Today" href="/" replace>
          <AppText color="secondary" variant="label">
            Return to Today
          </AppText>
        </Link>
      </Surface>
    </Screen>
  );
}
