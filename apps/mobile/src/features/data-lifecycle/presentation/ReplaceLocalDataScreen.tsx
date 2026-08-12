import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { createDataReplacementUseCases } from '../../../composition/data-replacement';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import type { DataExportFile } from '../../data-export/application/data-export-file';
import { isDataRestoreError } from '../../data-restore/application/data-restore-error';
import type {
  ParsedDataExport,
  RestoreData,
} from '../../data-restore/application/restore-data';
import type { DataRestoreFileContents } from '../../data-restore/application/select-data-restore-file-use-case';
import {
  describeRestorePreview,
  formatExportCreatedAt,
} from '../../data-restore/presentation/data-restore-formatting';
import {
  holdsNoRecords,
  toExpectedCapabilityPresence,
} from '../application/capability-presence';
import { isLocalDataReplacementError } from '../application/local-data-replacement-error';
import { IrreversibleActionAcknowledgement } from './IrreversibleActionAcknowledgement';

type UseCases = Readonly<{
  createRecoveryExport: Readonly<{ execute: () => Promise<DataExportFile> }>;
  parseExport: Readonly<{ execute: (text: string) => ParsedDataExport }>;
  replaceLocalData: Readonly<{ execute: (data: RestoreData) => Promise<void> }>;
  selectFile: Readonly<{ execute: () => Promise<DataRestoreFileContents> }>;
  shareRecoveryExport: Readonly<{
    execute: (file: DataExportFile) => Promise<void>;
  }>;
}>;

type RecoveryState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'creating' }>
  | Readonly<{ file: DataExportFile; status: 'ready' }>
  | Readonly<{ message: string; status: 'failed' }>;

type ScreenState =
  | Readonly<{ status: 'preparing' }>
  | Readonly<{ status: 'explaining' }>
  | Readonly<{ status: 'selecting' }>
  | Readonly<{ status: 'validating' }>
  | Readonly<{ parsed: ParsedDataExport; status: 'ready' }>
  | Readonly<{ status: 'replacing' }>
  | Readonly<{ hasRecoveryExport: boolean; status: 'replaced' }>
  | Readonly<{ message: string; status: 'failed' }>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onFinish?: () => void;
}>;

const howItWorks = [
  'Everything this app has stored on this device is replaced by the file you choose.',
  'The file is checked completely before anything is replaced.',
  'Replacing does not combine the file with what is already here.',
  'You can save a copy of your current information first.',
  'If replacing fails, what is already on this device is kept.',
  'Both files stay on this device. This app does not upload them.',
  'Export files you already saved somewhere else are never changed.',
];

export function ReplaceLocalDataScreen({
  loadUseCases = createDataReplacementUseCases,
  onFinish,
}: Props) {
  const [state, setState] = useState<ScreenState>({ status: 'preparing' });
  const [recovery, setRecovery] = useState<RecoveryState>({ status: 'idle' });
  const [isRecoveryDeclined, setIsRecoveryDeclined] = useState(false);
  const [isReplacementAcknowledged, setIsReplacementAcknowledged] =
    useState(false);
  const [useCases, setUseCases] = useState<UseCases>();
  const [notice, setNotice] = useState<string>();
  const isMounted = useRef(true);
  const requestSequence = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    void loadUseCases()
      .then((loaded) => {
        if (!isMounted.current) return;
        setUseCases(loaded);
        setState({ status: 'explaining' });
      })
      .catch((error: unknown) => {
        if (isMounted.current) setState(toFailure(error));
      });

    return () => {
      isMounted.current = false;
    };
  }, [loadUseCases]);

  /** Discards a result that a newer request or an unmount has superseded. */
  const isCurrent = (request: number) =>
    isMounted.current && request === requestSequence.current;

  const chooseFile = useCallback(() => {
    if (!useCases) return;
    const request = ++requestSequence.current;
    setNotice(undefined);
    // A different file is a different decision, so nothing already agreed to
    // carries over to it.
    setRecovery({ status: 'idle' });
    setIsRecoveryDeclined(false);
    setIsReplacementAcknowledged(false);
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
          status: 'ready',
        });
      })
      .catch((error: unknown) => {
        if (isCurrent(request)) setState(toFailure(error));
      });
  }, [useCases]);

  const createRecoveryExport = () => {
    if (!useCases) return;
    setNotice(undefined);
    setRecovery({ status: 'creating' });

    void useCases.createRecoveryExport
      .execute()
      .then((file) => {
        if (isMounted.current) setRecovery({ file, status: 'ready' });
      })
      .catch((error: unknown) => {
        if (isMounted.current) setRecovery(toRecoveryFailure(error));
      });
  };

  const shareRecoveryExport = (file: DataExportFile) => {
    if (!useCases) return;
    setNotice(undefined);

    void useCases.shareRecoveryExport
      .execute(file)
      .then(() => {
        if (!isMounted.current) return;
        // The app cannot see where a share sheet sent a file, or whether it
        // sent one at all, so it reports the handoff and never a save.
        setNotice(
          'Share options closed. If you did not save the copy, open share options again.',
        );
      })
      .catch(() => {
        // The copy itself is unaffected by a share sheet that could not open,
        // so the copy stays ready and only the handoff is reported.
        if (isMounted.current)
          setNotice(
            'Share options could not be opened. The copy is still on this device.',
          );
      });
  };

  const replace = (parsed: ParsedDataExport) => {
    if (!useCases) return;
    const request = ++requestSequence.current;
    const hasRecoveryExport = recovery.status === 'ready';
    setNotice(undefined);
    // No cancel control appears from here on: SQLite cannot honour a
    // half-transaction cancellation, so the app does not offer one.
    setState({ status: 'replacing' });

    void useCases.replaceLocalData
      .execute(parsed.data)
      .then(() => {
        if (isCurrent(request))
          setState({ hasRecoveryExport, status: 'replaced' });
      })
      .catch((error: unknown) => {
        if (isCurrent(request)) setState(toFailure(error));
      });
  };

  const confirm = (parsed: ParsedDataExport) => {
    Alert.alert(
      'Replace all local data?',
      'Everything this app has stored on this device will be replaced by the file you chose. This cannot be undone in the app.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => replace(parsed),
          style: 'destructive',
          text: 'Replace everything',
        },
      ],
    );
  };

  if (state.status === 'preparing') {
    return (
      <Screen accessibilityLabel="Preparing replacement" isCentered>
        <LoadingIndicator label="Preparing replacement" />
      </Screen>
    );
  }

  return (
    <Screen
      accessibilityLabel="Replace local data from an export"
      testID="replace-local-data-screen"
    >
      <View style={styles.container}>
        <SectionHeader
          subtitle="Replace everything stored on this device with a file this app exported earlier."
          title="Replace local data"
        />

        {state.status === 'replaced' ? null : (
          <Card testID="replace-local-data-notice" variant="outlined">
            <AppText accessibilityRole="header" variant="title">
              Before you replace
            </AppText>
            {howItWorks.map((item) => (
              <AppText color="secondary" key={item} style={styles.item}>
                {`• ${item}`}
              </AppText>
            ))}
          </Card>
        )}

        <View accessibilityLiveRegion="polite" style={styles.status}>
          {state.status === 'selecting' ? (
            <LoadingIndicator label="Opening the file picker" />
          ) : null}
          {state.status === 'validating' ? (
            <LoadingIndicator label="Checking the file" />
          ) : null}
          {recovery.status === 'creating' ? (
            <LoadingIndicator label="Preparing a copy of your current information" />
          ) : null}
          {state.status === 'replacing' ? (
            <LoadingIndicator label="Replacing your information" />
          ) : null}
          {state.status === 'failed' ? (
            <AppText color="danger" testID="replace-local-data-error">
              {state.message}
            </AppText>
          ) : null}
          {recovery.status === 'failed' ? (
            <AppText color="danger" testID="replace-local-data-recovery-error">
              {recovery.message}
            </AppText>
          ) : null}
          {notice ? (
            <AppText
              color="secondary"
              testID="replace-local-data-notice-status"
            >
              {notice}
            </AppText>
          ) : null}
        </View>

        {state.status === 'ready' ? renderPreview(state.parsed) : null}
        {state.status === 'ready' && recovery.status === 'ready'
          ? renderRecoveryReady(recovery.file)
          : null}

        {state.status === 'replaced' ? (
          <Card testID="replace-local-data-complete" variant="elevated">
            <AppText accessibilityRole="header" variant="title">
              Your information was replaced
            </AppText>
            <AppText color="secondary" style={styles.item}>
              This device now holds only what the file you chose contained. Open
              the tabs to see it.
            </AppText>
            {state.hasRecoveryExport ? (
              <AppText
                color="secondary"
                style={styles.item}
                testID="replace-local-data-recovery-notice"
              >
                The copy of your previous information is still on this device
                until you open Export my data again. If you have not saved it
                somewhere else, do that first.
              </AppText>
            ) : null}
          </Card>
        ) : null}

        {renderActions()}
      </View>
    </Screen>
  );

  function renderPreview(parsed: ParsedDataExport) {
    const isEmptyReplacement = holdsNoRecords(
      toExpectedCapabilityPresence(parsed.data),
    );

    return (
      <Card testID="replace-local-data-preview" variant="elevated">
        <AppText accessibilityRole="header" variant="title">
          This file will replace everything
        </AppText>
        <AppText color="secondary" style={styles.item}>
          {formatExportCreatedAt(parsed.preview.generatedAt)}
        </AppText>
        <AppText color="secondary" style={styles.item}>
          Nothing has been replaced yet. Review what this file contains, then
          confirm.
        </AppText>
        {isEmptyReplacement ? (
          <AppText
            color="secondary"
            style={styles.item}
            testID="replace-local-data-empty-file"
          >
            This file contains no records. Replacing with it leaves this app
            with nothing stored, exactly as deleting everything would.
          </AppText>
        ) : null}
        {describeRestorePreview(parsed.preview).map((row) => (
          <View key={row.label} style={styles.countRow}>
            <AppText color="secondary" variant="bodySmall">
              {row.label}
            </AppText>
            <AppText variant="bodySmall">{row.value}</AppText>
          </View>
        ))}
      </Card>
    );
  }

  function renderRecoveryReady(file: DataExportFile) {
    return (
      <Card testID="replace-local-data-recovery-ready" variant="elevated">
        <AppText accessibilityRole="header" variant="title">
          A copy of your current information is ready
        </AppText>
        <AppText color="secondary" style={styles.item}>
          {`${file.fileName} was created on this device. This app cannot tell whether it was saved anywhere else, so save it before replacing.`}
        </AppText>
      </Card>
    );
  }

  function renderActions() {
    if (state.status === 'replaced') {
      return onFinish ? (
        <AppButton
          label="Back to profile"
          onPress={onFinish}
          testID="finish-replace-local-data"
        />
      ) : null;
    }

    if (state.status === 'ready') return renderReadyActions(state.parsed);

    const isBusy =
      state.status === 'selecting' || state.status === 'validating';

    return (
      <AppButton
        disabled={isBusy || useCases === undefined}
        label={
          state.status === 'failed' ? 'Choose another file' : 'Choose file'
        }
        onPress={chooseFile}
        testID="choose-replace-local-data-file"
      />
    );
  }

  function renderReadyActions(parsed: ParsedDataExport) {
    const isBusy = recovery.status === 'creating';
    const hasRecoveryExport = recovery.status === 'ready';
    const isRecoveryResolved = hasRecoveryExport || isRecoveryDeclined;
    const canReplace =
      !isBusy && isRecoveryResolved && isReplacementAcknowledged;

    return (
      <>
        {hasRecoveryExport ? (
          <AppButton
            label="Open share options"
            onPress={() => shareRecoveryExport(recovery.file)}
            testID="share-replace-local-data-recovery"
            variant="outline"
          />
        ) : (
          <AppButton
            disabled={isBusy}
            label={
              recovery.status === 'failed'
                ? 'Try saving a copy again'
                : 'Save a copy of my current information'
            }
            onPress={createRecoveryExport}
            testID="create-replace-local-data-recovery"
            variant="outline"
          />
        )}

        {hasRecoveryExport ? null : (
          <IrreversibleActionAcknowledgement
            isChecked={isRecoveryDeclined}
            label="I do not want a copy of my current information."
            onChange={setIsRecoveryDeclined}
            testID="acknowledge-no-recovery-export"
          />
        )}

        <IrreversibleActionAcknowledgement
          isChecked={isReplacementAcknowledged}
          label="I understand everything stored here will be replaced."
          onChange={setIsReplacementAcknowledged}
          testID="acknowledge-replace-local-data"
        />

        <AppButton
          accessibilityLabel={
            canReplace
              ? 'Replace all local data'
              : isRecoveryResolved
                ? 'Replace all local data. Confirm you understand everything stored here will be replaced first.'
                : 'Replace all local data. Save a copy of your current information, or confirm you do not want one, first.'
          }
          disabled={!canReplace}
          label="Replace all local data"
          onPress={() => confirm(parsed)}
          testID="confirm-replace-local-data"
          variant="danger"
        />
        <AppButton
          disabled={isBusy}
          label="Choose a different file"
          onPress={chooseFile}
          testID="choose-replace-local-data-file"
          variant="outline"
        />
      </>
    );
  }
}

function toFailure(error: unknown): ScreenState {
  return {
    message:
      isLocalDataReplacementError(error) || isDataRestoreError(error)
        ? error.message
        : 'Your information could not be replaced. Nothing was changed, so you can try again.',
    status: 'failed',
  };
}

/**
 * Only this workflow's own errors carry a message known to be free of paths,
 * identifiers, and stored values. Anything else is replaced rather than shown.
 */
function toRecoveryFailure(error: unknown): RecoveryState {
  return {
    message: isLocalDataReplacementError(error)
      ? error.message
      : 'A copy of your current information could not be created. You can try again, or continue without one.',
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
