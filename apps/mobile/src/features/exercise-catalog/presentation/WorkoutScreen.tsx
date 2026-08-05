import {
  AppButton,
  AppText,
  Card,
  Screen,
  spacing,
} from '../../../design-system';
import { View } from 'react-native';

export function WorkoutScreen({
  onOpenLibrary,
}: Readonly<{ onOpenLibrary: () => void }>) {
  return (
    <Screen
      accessibilityLabel="Workout"
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Workout
        </AppText>
        <AppText color="secondary">
          Build your private exercise library now. Planning and workout sessions
          are coming later.
        </AppText>
      </View>
      <Card variant="outlined">
        <AppText variant="heading">Exercise Library</AppText>
        <AppText color="secondary">
          Create, organize, and find reusable exercises. Everything works
          offline.
        </AppText>
        <AppButton label="Open Exercise Library" onPress={onOpenLibrary} />
      </Card>
    </Screen>
  );
}
