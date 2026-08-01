import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { AppButton } from './AppButton';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';
import { Surface } from './Surface';

type EmptyStateProps = Readonly<{
  actionLabel?: string;
  description: string;
  icon?: AppIconName;
  onAction?: () => void;
  title: string;
}>;

export function EmptyState({
  actionLabel,
  description,
  icon,
  onAction,
  title,
}: EmptyStateProps) {
  return (
    <Surface>
      <View style={styles.content}>
        {icon ? <AppIcon name={icon} size="extraLarge" /> : null}
        <AppText accessibilityRole="header" variant="heading">
          {title}
        </AppText>
        <AppText color="secondary">{description}</AppText>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} onPress={onAction} />
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
});
