import { StyleSheet, View } from 'react-native';
import {
  AppButton,
  AppText,
  Card,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';

type Props = Readonly<{
  onOpenDataExport?: () => void;
  onOpenDataRestore?: () => void;
  onOpenLocalDataDeletion?: () => void;
}>;

/**
 * One home for taking information out, bringing it back, and removing it.
 *
 * Grouping them keeps the Profile form from growing a fourth and fifth action
 * below the fold, and puts the destructive one behind a deliberate step rather
 * than beside the buttons a user presses every week.
 */
export function DataControlsScreen({
  onOpenDataExport,
  onOpenDataRestore,
  onOpenLocalDataDeletion,
}: Props) {
  return (
    <Screen accessibilityLabel="Data controls" testID="data-controls-screen">
      <View style={styles.container}>
        <SectionHeader
          subtitle="Everything here happens on this device. This app has no account and stores nothing in the cloud."
          title="Data controls"
        />

        <Card testID="data-controls-summary" variant="outlined">
          <AppText accessibilityRole="header" variant="title">
            What you can do here
          </AppText>
          <AppText color="secondary" style={styles.item}>
            • Export creates a file containing what this app stores. It deletes
            nothing.
          </AppText>
          <AppText color="secondary" style={styles.item}>
            • Restore reads a file this app exported, and only into an app that
            holds no information yet.
          </AppText>
          <AppText color="secondary" style={styles.item}>
            • Deleting removes everything stored on this device. Files you
            already saved elsewhere are not deleted.
          </AppText>
        </Card>

        {onOpenDataExport ? (
          <AppButton
            label="Export my data"
            onPress={onOpenDataExport}
            testID="open-data-export"
            variant="outline"
          />
        ) : null}
        {onOpenDataRestore ? (
          <AppButton
            label="Restore my data"
            onPress={onOpenDataRestore}
            testID="open-data-restore"
            variant="outline"
          />
        ) : null}
        {onOpenLocalDataDeletion ? (
          <AppButton
            label="Delete all local data"
            onPress={onOpenLocalDataDeletion}
            testID="open-delete-local-data"
            variant="outline"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  item: {
    marginTop: spacing.sm,
  },
});
