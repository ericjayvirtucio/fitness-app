import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { createDataLifecycleUseCases } from '../../../composition/data-lifecycle';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import type { LocalDataErasureResult } from '../application/erase-local-data-use-case';
import { isLocalDataErasureError } from '../application/local-data-erasure-error';
import { IrreversibleActionAcknowledgement } from './IrreversibleActionAcknowledgement';

type UseCases = Readonly<{
  eraseLocalData: Readonly<{ execute: () => Promise<LocalDataErasureResult> }>;
  getLocalDataPresence: Readonly<{ execute: () => Promise<boolean> }>;
}>;

type ScreenState =
  | Readonly<{ status: 'preparing' }>
  | Readonly<{ hasStoredData: boolean; status: 'explaining' }>
  | Readonly<{ status: 'deleting' }>
  | Readonly<{ isCleanupComplete: boolean; status: 'deleted' }>
  | Readonly<{ message: string; status: 'failed' }>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onFinish?: () => void;
  onOpenDataExport?: () => void;
}>;

const whatIsRemoved = [
  'Your profile details and goal settings',
  'Nutrition entries and saved nutrition items',
  'Water and other fluid entries, and your daily target',
  'Exercises, your weekly plan, and any workout in progress',
  'Completed workouts, including every logged set',
  'Weight check-ins',
  'Any export file this app is still holding on this device',
];

const whatIsNotRemoved = [
  'Export files you already saved somewhere else. This app cannot reach them.',
  'The app itself. It stays installed and you can start again straight away.',
  'Anything in the cloud. This app has no account and stores nothing online.',
];

export function DeleteLocalDataScreen({
  loadUseCases = createDataLifecycleUseCases,
  onFinish,
  onOpenDataExport,
}: Props) {
  const [state, setState] = useState<ScreenState>({ status: 'preparing' });
  const [useCases, setUseCases] = useState<UseCases>();
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const isMounted = useRef(true);
  const requestSequence = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    void loadUseCases()
      .then(async (loaded) => {
        if (!isMounted.current) return;
        setUseCases(loaded);
        const hasStoredData = await loaded.getLocalDataPresence.execute();
        if (!isMounted.current) return;
        setState({ hasStoredData, status: 'explaining' });
      })
      .catch((error: unknown) => {
        if (isMounted.current) setState(toFailure(error));
      });

    return () => {
      isMounted.current = false;
    };
  }, [loadUseCases]);

  const erase = () => {
    if (!useCases) return;
    const request = ++requestSequence.current;
    // No cancel control appears from here on: SQLite cannot honour a
    // half-transaction cancellation, so the app does not offer one.
    setState({ status: 'deleting' });

    void useCases.eraseLocalData
      .execute()
      .then((result) => {
        if (!isCurrent(request)) return;
        setState({
          isCleanupComplete: result.isCleanupComplete,
          status: 'deleted',
        });
      })
      .catch((error: unknown) => {
        if (isCurrent(request)) setState(toFailure(error));
      });
  };

  /** Discards a result that a newer request or an unmount has superseded. */
  function isCurrent(request: number): boolean {
    return isMounted.current && request === requestSequence.current;
  }

  const confirm = () => {
    Alert.alert(
      'Delete all local data?',
      'Everything this app has stored on this device will be deleted. This cannot be undone in the app.',
      [
        { style: 'cancel', text: 'Cancel' },
        { onPress: erase, style: 'destructive', text: 'Delete everything' },
      ],
    );
  };

  if (state.status === 'preparing') {
    return (
      <Screen accessibilityLabel="Preparing deletion" isCentered>
        <LoadingIndicator label="Preparing deletion" />
      </Screen>
    );
  }

  return (
    <Screen
      accessibilityLabel="Delete all local data"
      testID="delete-local-data-screen"
    >
      <View style={styles.container}>
        <SectionHeader
          subtitle="Remove everything this app has stored on this device."
          title="Delete all local data"
        />

        {state.status === 'deleted' ? null : (
          <>
            <Card testID="delete-local-data-removed" variant="outlined">
              <AppText accessibilityRole="header" variant="title">
                What is deleted
              </AppText>
              {whatIsRemoved.map((item) => (
                <AppText color="secondary" key={item} style={styles.item}>
                  {`• ${item}`}
                </AppText>
              ))}
            </Card>

            <Card testID="delete-local-data-kept" variant="outlined">
              <AppText accessibilityRole="header" variant="title">
                What is not deleted
              </AppText>
              {whatIsNotRemoved.map((item) => (
                <AppText color="secondary" key={item} style={styles.item}>
                  {`• ${item}`}
                </AppText>
              ))}
            </Card>
          </>
        )}

        <View accessibilityLiveRegion="polite" style={styles.status}>
          {state.status === 'deleting' ? (
            <LoadingIndicator label="Deleting local data" />
          ) : null}
          {state.status === 'failed' ? (
            <AppText color="danger" testID="delete-local-data-error">
              {state.message}
            </AppText>
          ) : null}
          {state.status === 'explaining' && !state.hasStoredData ? (
            <AppText color="secondary" testID="delete-local-data-empty">
              This app is not storing any information yet, so there is nothing
              to delete.
            </AppText>
          ) : null}
        </View>

        {state.status === 'deleted' ? (
          <Card testID="delete-local-data-complete" variant="elevated">
            <AppText accessibilityRole="header" variant="title">
              Everything on this device was deleted
            </AppText>
            <AppText color="secondary" style={styles.item}>
              This app is back to how it was after installing it. You can start
              again, or restore a file you exported earlier.
            </AppText>
            {state.isCleanupComplete ? null : (
              <AppText
                color="secondary"
                style={styles.item}
                testID="delete-local-data-cleanup-warning"
              >
                An export file this app created is still on this device. It will
                be removed the next time you open Export my data.
              </AppText>
            )}
          </Card>
        ) : null}

        {renderActions()}
      </View>
    </Screen>
  );

  function renderActions() {
    if (state.status === 'deleted') {
      return onFinish ? (
        <AppButton
          label="Back to profile"
          onPress={onFinish}
          testID="finish-delete-local-data"
        />
      ) : null;
    }

    const isBusy = state.status === 'deleting';
    const hasNothingToDelete =
      state.status === 'explaining' && !state.hasStoredData;

    return (
      <>
        {onOpenDataExport && !isBusy ? (
          <AppButton
            label="Export my data first"
            onPress={onOpenDataExport}
            testID="export-before-delete-local-data"
            variant="outline"
          />
        ) : null}
        <IrreversibleActionAcknowledgement
          isChecked={isAcknowledged}
          label="I understand this cannot be undone in the app."
          onChange={setIsAcknowledged}
          testID="acknowledge-delete-local-data"
        />
        <AppButton
          accessibilityLabel={
            hasNothingToDelete
              ? 'Delete all local data. There is nothing stored to delete.'
              : isAcknowledged
                ? 'Delete all local data'
                : 'Delete all local data. Confirm you understand this cannot be undone first.'
          }
          disabled={
            isBusy ||
            hasNothingToDelete ||
            !isAcknowledged ||
            useCases === undefined
          }
          label="Delete all local data"
          onPress={confirm}
          testID="confirm-delete-local-data"
          variant="danger"
        />
      </>
    );
  }
}

function toFailure(error: unknown): ScreenState {
  return {
    message: isLocalDataErasureError(error)
      ? error.message
      : 'Your information could not be deleted. Nothing was changed, so you can try again.',
    status: 'failed',
  };
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  item: {
    marginTop: spacing.sm,
  },
  status: {
    gap: spacing.sm,
  },
});
