import { router } from 'expo-router';
import { DeleteLocalDataScreen } from '../src/features/data-lifecycle/presentation/DeleteLocalDataScreen';

export default function DeleteLocalDataRoute() {
  return (
    <DeleteLocalDataScreen
      onFinish={() => {
        // Every route above the tabs is dismissed so no back gesture can reach
        // a screen whose records no longer exist, including an active workout.
        // The guard keeps this correct if the screen is ever reached as the
        // first route in the stack.
        if (router.canDismiss()) router.dismissAll();
        router.replace('/profile');
      }}
      onOpenDataExport={() => router.push('/data-export')}
    />
  );
}
