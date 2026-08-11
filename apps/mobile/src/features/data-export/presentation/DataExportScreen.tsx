import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createDataExportUseCases } from '../../../composition/data-export';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import type {
  DataExportCancellation,
  DataExportResult,
} from '../application/create-data-export-use-case';
import { isDataExportError } from '../application/data-export-error';
import type { DataExportFile } from '../application/data-export-file';
import {
  describeExportCounts,
  formatExportSize,
} from './data-export-formatting';

type UseCases = Readonly<{
  clearExports: Readonly<{ execute: () => Promise<void> }>;
  createExport: Readonly<{
    execute: (
      cancellation: DataExportCancellation,
    ) => Promise<DataExportResult>;
  }>;
  shareExport: Readonly<{ execute: (file: DataExportFile) => Promise<void> }>;
}>;

type ScreenState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'generating' }>
  | Readonly<{ export: DataExportResult; status: 'ready' }>
  | Readonly<{ message: string; status: 'failed' }>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
}>;

const includedData = [
  'Profile details and your goal settings',
  'Nutrition entries and saved nutrition items',
  'Water and other fluid entries, and your current daily target',
  'Exercises and your weekly plan',
  'Workouts you completed, including every logged set',
  'Weight check-ins',
];

const beforeYouExport = [
  'The file is created on this device.',
  'This app does not upload it anywhere.',
  'You choose where it goes next. Once it leaves this app, this app can no longer protect it.',
  'The file is not encrypted.',
  'This file can be restored later, but only into an app that has no information in it yet.',
];

export function DataExportScreen({
  loadUseCases = createDataExportUseCases,
}: Props) {
  const [state, setState] = useState<ScreenState>({ status: 'idle' });
  const [useCases, setUseCases] = useState<UseCases>();
  const [isSharing, setIsSharing] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState<string>();
  const isMounted = useRef(true);
  const requestSequence = useRef(0);
  const cancellation = useRef<{ isCancelled: boolean }>({ isCancelled: false });

  useEffect(() => {
    isMounted.current = true;
    void loadUseCases().then((loaded) => {
      if (!isMounted.current) return;
      setUseCases(loaded);
      // Removes anything a previous visit or a crash left in the cache.
      return loaded.clearExports.execute();
    });

    return () => {
      isMounted.current = false;
      cancellation.current.isCancelled = true;
    };
  }, [loadUseCases]);

  const createExport = useCallback(() => {
    if (!useCases) return;
    const request = ++requestSequence.current;
    cancellation.current = { isCancelled: false };
    const token = cancellation.current;
    setHandoffMessage(undefined);
    setState({ status: 'generating' });

    void useCases.createExport
      .execute(token)
      .then((result) => {
        if (!isMounted.current || request !== requestSequence.current) return;
        setState({ export: result, status: 'ready' });
      })
      .catch((error: unknown) => {
        if (!isMounted.current || request !== requestSequence.current) return;
        if (isDataExportError(error) && error.code === 'cancelled') {
          setState({ status: 'idle' });
          setHandoffMessage('Export cancelled. Nothing was saved.');
          return;
        }
        setState({
          message: isDataExportError(error)
            ? error.message
            : 'The export could not be created. No export file was saved.',
          status: 'failed',
        });
      });
  }, [useCases]);

  const cancel = () => {
    cancellation.current.isCancelled = true;
  };

  const share = (file: DataExportFile) => {
    if (!useCases) return;
    setIsSharing(true);
    setHandoffMessage(undefined);
    void useCases.shareExport
      .execute(file)
      .then(() => {
        if (!isMounted.current) return;
        // The platform never tells the app whether the user saved the file, so
        // this must not claim success.
        setHandoffMessage(
          'Share options closed. If you did not save the file, open share options again.',
        );
      })
      .catch((error: unknown) => {
        if (!isMounted.current) return;
        setHandoffMessage(
          isDataExportError(error)
            ? error.message
            : 'Sharing did not finish. The export is still on this device.',
        );
      })
      .finally(() => {
        if (isMounted.current) setIsSharing(false);
      });
  };

  const discard = () => {
    requestSequence.current += 1;
    setHandoffMessage(undefined);
    setState({ status: 'idle' });
    void useCases?.clearExports.execute();
  };

  return (
    <Screen accessibilityLabel="Export my data" testID="data-export-screen">
      <View style={styles.container}>
        <SectionHeader
          subtitle="Create a file containing the information this app stores on this device."
          title="Export my data"
        />

        <Card variant="outlined">
          <AppText accessibilityRole="header" variant="title">
            What is included
          </AppText>
          {includedData.map((item) => (
            <AppText color="secondary" key={item} style={styles.item}>
              {`• ${item}`}
            </AppText>
          ))}
        </Card>

        <Card variant="outlined" testID="data-export-privacy-notice">
          <AppText accessibilityRole="header" variant="title">
            Before you export
          </AppText>
          {beforeYouExport.map((item) => (
            <AppText color="secondary" key={item} style={styles.item}>
              {`• ${item}`}
            </AppText>
          ))}
        </Card>

        <View accessibilityLiveRegion="polite" style={styles.status}>
          {state.status === 'generating' ? (
            <LoadingIndicator label="Creating export" />
          ) : null}
          {state.status === 'failed' ? (
            <AppText color="danger" testID="data-export-error">
              {state.message}
            </AppText>
          ) : null}
          {handoffMessage ? (
            <AppText color="secondary" testID="data-export-handoff-status">
              {handoffMessage}
            </AppText>
          ) : null}
        </View>

        {state.status === 'ready' ? (
          <Card testID="data-export-ready" variant="elevated">
            <AppText accessibilityRole="header" variant="title">
              Export ready
            </AppText>
            <AppText color="secondary" style={styles.item}>
              {`${state.export.file.fileName} · ${formatExportSize(state.export.file.byteSize)}`}
            </AppText>
            {describeExportCounts(state.export.counts).map((row) => (
              <View key={row.label} style={styles.countRow}>
                <AppText color="secondary" variant="bodySmall">
                  {row.label}
                </AppText>
                <AppText variant="bodySmall">{String(row.value)}</AppText>
              </View>
            ))}
          </Card>
        ) : null}

        {state.status === 'generating' ? (
          <AppButton
            label="Cancel export"
            onPress={cancel}
            testID="cancel-data-export"
            variant="outline"
          />
        ) : null}

        {state.status === 'ready' ? (
          <>
            <AppButton
              isLoading={isSharing}
              label="Open share options"
              onPress={() => share(state.export.file)}
              testID="share-data-export"
            />
            <AppButton
              label="Discard export"
              onPress={discard}
              testID="discard-data-export"
              variant="outline"
            />
          </>
        ) : (
          <AppButton
            disabled={state.status === 'generating' || useCases === undefined}
            label={state.status === 'failed' ? 'Try again' : 'Create export'}
            onPress={createExport}
            testID="create-data-export"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  countRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  item: {
    marginTop: spacing.sm,
  },
  status: {
    gap: spacing.sm,
  },
});
