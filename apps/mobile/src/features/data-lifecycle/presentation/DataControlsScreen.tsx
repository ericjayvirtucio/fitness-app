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
  onOpenLocalDataReplacement?: () => void;
}>;

/**
 * One home for taking information out, bringing it back, replacing it, and
 * removing it.
 *
 * Grouping them keeps the Profile form from growing more actions below the
 * fold, and puts the destructive ones behind a deliberate step rather than
 * beside the buttons a user presses every week. Each row names one operation,
 * so nothing here has to infer which one the user meant.
 */
export function DataControlsScreen({
  onOpenDataExport,
  onOpenDataRestore,
  onOpenLocalDataDeletion,
  onOpenLocalDataReplacement,
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
            • Replacing swaps everything stored on this device for a file this
            app exported. It does not combine the two.
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
        {onOpenLocalDataReplacement ? (
          <AppButton
            label="Replace local data from an export"
            onPress={onOpenLocalDataReplacement}
            testID="open-replace-local-data"
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
