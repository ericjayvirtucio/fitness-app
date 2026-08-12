import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createDataRestoreUseCases } from '../../../composition/data-restore';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import type { DataRestoreFileContents } from '../application/select-data-restore-file-use-case';
import { isDataRestoreError } from '../application/data-restore-error';
import type {
  ParsedDataExport,
  RestoreData,
} from '../application/restore-data';
import {
  describeRestorePreview,
  formatExportCreatedAt,
} from './data-restore-formatting';

type UseCases = Readonly<{
  getRestoreTarget: Readonly<{ execute: () => Promise<boolean> }>;
  parseExport: Readonly<{ execute: (text: string) => ParsedDataExport }>;
  restoreExport: Readonly<{ execute: (data: RestoreData) => Promise<void> }>;
  selectFile: Readonly<{ execute: () => Promise<DataRestoreFileContents> }>;
}>;

type ScreenState =
  | Readonly<{ status: 'preparing' }>
  | Readonly<{ status: 'explaining' }>
  | Readonly<{ status: 'blocked' }>
  | Readonly<{ status: 'selecting' }>
  | Readonly<{ status: 'validating' }>
  | Readonly<{ parsed: ParsedDataExport; status: 'previewing' }>
  | Readonly<{ status: 'restoring' }>
  | Readonly<{ status: 'restored' }>
  | Readonly<{ message: string; status: 'failed' }>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onFinish?: () => void;
}>;

const howItWorks = [
  'Only files this app exported can be restored.',
  'Export format version 1 is supported.',
  'Restoring works only when this app contains no information yet.',
  'The file is read on this device. This app does not upload it.',
  'Everything is checked before anything is saved.',
  'Restoring is all or nothing. If it fails, nothing is saved.',
  'Combining an export with information already here is not supported.',
  'To swap what is already here for a file, use Replace local data instead.',
];

export function DataRestoreScreen({
  loadUseCases = createDataRestoreUseCases,
  onFinish,
}: Props) {
  const [state, setState] = useState<ScreenState>({ status: 'preparing' });
  const [useCases, setUseCases] = useState<UseCases>();
  const [notice, setNotice] = useState<string>();
  const isMounted = useRef(true);
  const requestSequence = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    void loadUseCases()
      .then(async (loaded) => {
        if (!isMounted.current) return;
        setUseCases(loaded);
        const isEmpty = await loaded.getRestoreTarget.execute();
        if (!isMounted.current) return;
        setState({ status: isEmpty ? 'explaining' : 'blocked' });
      })
      .catch((error: unknown) => {
        if (isMounted.current) setState(toFailure(error));
      });

    return () => {
      isMounted.current = false;
    };
  }, [loadUseCases]);

  /** Discards a result that a newer selection or an unmount has superseded. */
  const isCurrent = (request: number) =>
    isMounted.current && request === requestSequence.current;

  const chooseFile = useCallback(() => {
    if (!useCases) return;
    const request = ++requestSequence.current;
    setNotice(undefined);
    setState({ status: 'selecting' });

    void useCases.selectFile
      .execute()
      .then(async (contents) => {
        if (!isCurrent(request)) return;
        if (contents.status === 'cancelled') {
          setState({ status: 'explaining' });
          setNotice('No file was selected. Nothing was changed.');
          return;
        }
        setState({ status: 'validating' });
        // Lets the validating state paint before the parse takes the thread.
        await Promise.resolve();
        if (!isCurrent(request)) return;
        setState({
          parsed: useCases.parseExport.execute(contents.text),
          status: 'previewing',
        });
      })
      .catch((error: unknown) => {
        if (isCurrent(request)) setState(toFailure(error));
      });
  }, [useCases]);

  const restore = (parsed: ParsedDataExport) => {
    if (!useCases) return;
    const request = ++requestSequence.current;
    setNotice(undefined);
    // No cancel control appears from here on: SQLite cannot honour a
    // half-transaction cancellation, so the app does not offer one.
    setState({ status: 'restoring' });

    void useCases.restoreExport
      .execute(parsed.data)
      .then(() => {
        if (isCurrent(request)) setState({ status: 'restored' });
      })
      .catch((error: unknown) => {
        if (!isCurrent(request)) return;
        setState(
          isDataRestoreError(error) && error.code === 'target-not-empty'
            ? { status: 'blocked' }
            : toFailure(error),
        );
      });
  };

  if (state.status === 'preparing') {
    return (
      <Screen accessibilityLabel="Preparing restore" isCentered>
        <LoadingIndicator label="Preparing restore" />
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Restore my data" testID="data-restore-screen">
      <View style={styles.container}>
        <SectionHeader
          subtitle="Bring back information from a file this app exported earlier."
          title="Restore my data"
        />

        <Card testID="data-restore-notice" variant="outlined">
          <AppText accessibilityRole="header" variant="title">
            Before you restore
          </AppText>
          {howItWorks.map((item) => (
            <AppText color="secondary" key={item} style={styles.item}>
              {`• ${item}`}
            </AppText>
          ))}
        </Card>

        <View accessibilityLiveRegion="polite" style={styles.status}>
          {state.status === 'selecting' ? (
            <LoadingIndicator label="Opening the file picker" />
          ) : null}
          {state.status === 'validating' ? (
            <LoadingIndicator label="Checking the file" />
          ) : null}
          {state.status === 'restoring' ? (
            <LoadingIndicator label="Restoring your information" />
          ) : null}
          {state.status === 'failed' ? (
            <AppText color="danger" testID="data-restore-error">
              {state.message}
            </AppText>
          ) : null}
          {notice ? (
            <AppText color="secondary" testID="data-restore-notice-status">
              {notice}
            </AppText>
          ) : null}
        </View>

        {state.status === 'blocked' ? (
          <Card testID="data-restore-blocked" variant="elevated">
            <AppText accessibilityRole="header" variant="title">
              This app already has information
            </AppText>
            <AppText color="secondary" style={styles.item}>
              Nothing was changed. Restoring is only supported on an
              installation that contains no information yet.
            </AppText>
            <AppText color="secondary" style={styles.item}>
              To swap what is here for this file instead, go back to Data
              controls and choose Replace local data from an export.
            </AppText>
          </Card>
        ) : null}

        {state.status === 'previewing' ? (
          <Card testID="data-restore-preview" variant="elevated">
            <AppText accessibilityRole="header" variant="title">
              Ready to restore
            </AppText>
            <AppText color="secondary" style={styles.item}>
              {formatExportCreatedAt(state.parsed.preview.generatedAt)}
            </AppText>
            <AppText color="secondary" style={styles.item}>
              Nothing has been restored yet. Review what this file contains,
              then confirm.
            </AppText>
            {describeRestorePreview(state.parsed.preview).map((row) => (
              <View key={row.label} style={styles.countRow}>
                <AppText color="secondary" variant="bodySmall">
                  {row.label}
                </AppText>
                <AppText variant="bodySmall">{row.value}</AppText>
              </View>
            ))}
          </Card>
        ) : null}

        {state.status === 'restored' ? (
          <Card testID="data-restore-complete" variant="elevated">
            <AppText accessibilityRole="header" variant="title">
              Restore complete
            </AppText>
            <AppText color="secondary" style={styles.item}>
              Your information is back on this device. Open the tabs to see it.
            </AppText>
          </Card>
        ) : null}

        {renderActions()}
      </View>
    </Screen>
  );

  function renderActions() {
    if (state.status === 'restored') {
      return onFinish ? (
        <AppButton
          label="Back to profile"
          onPress={onFinish}
          testID="finish-data-restore"
        />
      ) : null;
    }

    if (state.status === 'blocked') return null;

    if (state.status === 'previewing') {
      const { parsed } = state;
      return (
        <>
          <AppButton
            label="Restore my data"
            onPress={() => restore(parsed)}
            testID="confirm-data-restore"
          />
          <AppButton
            label="Choose a different file"
            onPress={chooseFile}
            testID="choose-data-restore-file"
            variant="outline"
          />
        </>
      );
    }

    const isBusy =
      state.status === 'selecting' ||
      state.status === 'validating' ||
      state.status === 'restoring';

    return (
      <AppButton
        disabled={isBusy || useCases === undefined}
        label={
          state.status === 'failed' ? 'Choose another file' : 'Choose file'
        }
        onPress={chooseFile}
        testID="choose-data-restore-file"
      />
    );
  }
}

function toFailure(error: unknown): ScreenState {
  return {
    message: isDataRestoreError(error)
      ? error.message
      : 'The file could not be restored. Nothing was changed.',
    status: 'failed',
  };
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
