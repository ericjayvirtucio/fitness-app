import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  spacing,
  Surface,
} from '../design-system';
import { initializePersistence } from '../composition/persistence';

type PersistenceGateProps = Readonly<{
  children: ReactNode;
  initialize?: () => Promise<void>;
}>;

type InitializationState = 'failed' | 'loading' | 'ready';

export function PersistenceGate({
  children,
  initialize = initializePersistence,
}: PersistenceGateProps) {
  const [state, setState] = useState<InitializationState>('loading');

  const startInitialization = useCallback(() => {
    setState('loading');
    void initialize().then(
      () => setState('ready'),
      () => setState('failed'),
    );
  }, [initialize]);

  useEffect(() => {
    startInitialization();
  }, [startInitialization]);

  if (state === 'loading') {
    return (
      <Screen accessibilityLabel="Preparing local storage" isCentered>
        <LoadingIndicator label="Preparing local storage" />
      </Screen>
    );
  }

  if (state === 'failed') {
    return (
      <Screen accessibilityLabel="Local storage error" isCentered>
        <Surface style={{ gap: spacing.md }}>
          <AppText accessibilityRole="header" variant="heading">
            Local storage is unavailable
          </AppText>
          <AppText color="secondary">
            The app could not prepare its on-device storage. No information was
            changed.
          </AppText>
          <AppButton
            accessibilityLabel="Try preparing local storage again"
            label="Try again"
            onPress={startInitialization}
          />
        </Surface>
      </Screen>
    );
  }

  return children;
}
