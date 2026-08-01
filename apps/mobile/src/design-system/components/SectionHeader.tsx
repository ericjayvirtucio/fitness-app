import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type SectionHeaderProps = Readonly<{
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  title: string;
}>;

export function SectionHeader({
  actionLabel,
  onAction,
  subtitle,
  title,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" variant="title">
          {title}
        </AppText>
        {subtitle ? (
          <AppText color="secondary" variant="bodySmall">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} onPress={onAction} variant="ghost" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
});
