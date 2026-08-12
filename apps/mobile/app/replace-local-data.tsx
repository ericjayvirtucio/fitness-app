import { router } from 'expo-router';
import { ReplaceLocalDataScreen } from '../src/features/data-lifecycle/presentation/ReplaceLocalDataScreen';

export default function ReplaceLocalDataRoute() {
  return (
    <ReplaceLocalDataScreen
      onFinish={() => {
        // Every route above the tabs is dismissed so no back gesture can reach
        // a screen whose records belonged to the dataset that was replaced,
        // including an active workout. The guard keeps this correct if the
        // screen is ever reached as the first route in the stack.
        if (router.canDismiss()) router.dismissAll();
        router.replace('/profile');
      }}
    />
  );
}
