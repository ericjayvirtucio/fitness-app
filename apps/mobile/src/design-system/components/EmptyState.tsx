import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';
import { AppText } from './AppText';
import { Surface } from './Surface';

type EmptyStateProps = Readonly<{ description: string; title: string }>;

export function EmptyState({ description, title }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <Surface accessibilityLabel={`${title}. ${description}`} accessible>
      <View style={styles.content}>
        <AppText accessibilityRole="header" variant="heading">
          {title}
        </AppText>
        <AppText style={{ color: theme.colors.textSecondary }}>
          {description}
        </AppText>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
});
