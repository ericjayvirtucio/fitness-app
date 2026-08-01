import { ThemeProvider } from '@react-navigation/native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RouteErrorFallback } from '../src/navigation/RouteErrorFallback';
import { useAppTheme } from '../src/design-system';

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorFallback {...props} />;
}

export default function RootLayout() {
  const theme = useAppTheme();

  return (
    <ThemeProvider value={theme.navigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
