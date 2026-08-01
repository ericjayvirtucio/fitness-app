import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

type ScreenProps = ComponentProps<typeof ScrollView>;

export function Screen({
  children,
  contentContainerStyle,
  style,
  ...props
}: ScreenProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.scrollView, style]}
        {...props}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});
