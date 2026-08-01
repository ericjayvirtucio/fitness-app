import { Link } from 'expo-router';
import { AppText, Screen, Surface, useAppTheme } from '../src/design-system';
import { spacing } from '../src/design-system/theme/tokens';

export default function NotFoundScreen() {
  const theme = useAppTheme();

  return (
    <Screen accessibilityLabel="Page not found">
      <Surface style={{ gap: spacing.md }}>
        <AppText accessibilityRole="header" variant="heading">
          Page not found
        </AppText>
        <AppText style={{ color: theme.colors.textSecondary }}>
          This destination is not available.
        </AppText>
        <Link accessibilityLabel="Return to Today" href="/" replace>
          <AppText style={{ color: theme.colors.accent }} variant="label">
            Return to Today
          </AppText>
        </Link>
      </Surface>
    </Screen>
  );
}
