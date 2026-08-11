import { ThemeProvider } from '@react-navigation/native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RouteErrorFallback } from '../src/navigation/RouteErrorFallback';
import { useAppTheme } from '../src/design-system';
import { PersistenceGate } from '../src/persistence/PersistenceGate';

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorFallback {...props} />;
}

export default function RootLayout() {
  const theme = useAppTheme();

  return (
    <ThemeProvider value={theme.navigationTheme}>
      <PersistenceGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="body-measurements/index" />
          <Stack.Screen name="data-export" />
          <Stack.Screen name="data-restore" />
          <Stack.Screen name="body-measurements/new" />
          <Stack.Screen name="body-measurements/[id]" />
          <Stack.Screen name="goals-energy" />
          <Stack.Screen name="hydration-entry/new" />
          <Stack.Screen name="hydration-entry/[id]" />
          <Stack.Screen name="hydration-target" />
          <Stack.Screen name="nutrition-entry/new" />
          <Stack.Screen name="nutrition-entry/[id]" />
          <Stack.Screen name="nutrition-add" />
          <Stack.Screen name="nutrition-catalog/new" />
          <Stack.Screen name="nutrition-catalog/[id]/edit" />
          <Stack.Screen name="nutrition-catalog/[id]/log" />
          <Stack.Screen name="exercise-library" />
          <Stack.Screen name="exercise-library/new" />
          <Stack.Screen name="exercise-library/[id]/edit" />
          <Stack.Screen name="workout-plan/[weekday]" />
          <Stack.Screen name="workout-session/active" />
          <Stack.Screen name="workout-history/index" />
          <Stack.Screen name="workout-history/[id]" />
          <Stack.Screen name="workout-history/exercise/[id]" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </PersistenceGate>
    </ThemeProvider>
  );
}
