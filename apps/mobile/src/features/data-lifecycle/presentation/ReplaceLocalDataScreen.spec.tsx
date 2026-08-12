import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import type { DataExportFile } from '../../data-export/application/data-export-file';
import { DataRestoreError } from '../../data-restore/application/data-restore-error';
import { parseDataExport } from '../../data-restore/application/parse-data-export';
import type {
  ParsedDataExport,
  RestoreData,
} from '../../data-restore/application/restore-data';
import type { DataRestoreFileContents } from '../../data-restore/application/select-data-restore-file-use-case';
import {
  buildEmptyExport,
  buildExport,
  syntheticToday,
} from '../../data-restore/application/synthetic-data-export.spec-helper';
import { LocalDataReplacementError } from '../application/local-data-replacement-error';
import { ReplaceLocalDataScreen } from './ReplaceLocalDataScreen';

const recoveryFile: DataExportFile = {
  byteSize: 4096,
  fileName: 'fitness-app-export-20260812T090000Z.json',
  uri: 'file:///cache/data-export/fitness-app-export-20260812T090000Z.json',
};

function parsed(document: Record<string, unknown> = buildExport()) {
  const result = parseDataExport(JSON.stringify(document), syntheticToday);
  if (!result.isSuccess) throw new Error('the synthetic export must be valid');
  return result.value;
}

type Overrides = Readonly<{
  createRecoveryExport?: () => Promise<DataExportFile>;
  onFinish?: () => void;
  parse?: (text: string) => ParsedDataExport;
  replace?: (data: RestoreData) => Promise<void>;
  selectFile?: () => Promise<DataRestoreFileContents>;
  share?: (file: DataExportFile) => Promise<void>;
}>;

function renderScreen(overrides: Overrides = {}) {
  return render(
    <ReplaceLocalDataScreen
      loadUseCases={() =>
        Promise.resolve({
          createRecoveryExport: {
            execute:
              overrides.createRecoveryExport ??
              (() => Promise.resolve(recoveryFile)),
          },
          parseExport: { execute: overrides.parse ?? (() => parsed()) },
          replaceLocalData: {
            execute: overrides.replace ?? (() => Promise.resolve()),
          },
          selectFile: {
            execute:
              overrides.selectFile ??
              (() => Promise.resolve({ status: 'selected', text: '{}' })),
          },
          shareRecoveryExport: {
            execute: overrides.share ?? (() => Promise.resolve()),
          },
        })
      }
      {...(overrides.onFinish ? { onFinish: overrides.onFinish } : {})}
    />,
  );
}

type AlertSpy = jest.SpyInstance<void, Parameters<typeof Alert.alert>>;

function alertButton(alert: AlertSpy, style: AlertButton['style']) {
  return alert.mock.calls[0]?.[2]?.find((button) => button.style === style);
}

function spyOnAlert(): AlertSpy {
  return jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
}

async function chooseFile(): Promise<void> {
  await fireEvent.press(
    await screen.findByTestId('choose-replace-local-data-file'),
  );
}

async function declineRecovery(): Promise<void> {
  await fireEvent.press(
    await screen.findByTestId('acknowledge-no-recovery-export'),
  );
}

async function acknowledgeReplacement(): Promise<void> {
  await fireEvent.press(
    await screen.findByTestId('acknowledge-replace-local-data'),
  );
}

async function replaceEverything(): Promise<AlertSpy> {
  const alert = spyOnAlert();
  await fireEvent.press(screen.getByTestId('confirm-replace-local-data'));
  alertButton(alert, 'destructive')?.onPress?.();
  return alert;
}

describe('ReplaceLocalDataScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('explains what replacing does before anything is chosen', async () => {
    await renderScreen();

    expect(
      await screen.findByRole('header', { name: 'Before you replace' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• The file is checked completely before anything is replaced.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Replacing does not combine the file with what is already here.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• If replacing fails, what is already on this device is kept.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Both files stay on this device. This app does not upload them.',
      ),
    ).toBeOnTheScreen();
  });

  it('offers no destructive control before a file has been validated', async () => {
    await renderScreen();
    await screen.findByTestId('choose-replace-local-data-file');

    expect(
      screen.queryByTestId('confirm-replace-local-data'),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByTestId('acknowledge-replace-local-data'),
    ).not.toBeOnTheScreen();
  });

  it('treats a cancelled picker as a neutral outcome', async () => {
    await renderScreen({
      selectFile: () => Promise.resolve({ status: 'cancelled' }),
    });
    await chooseFile();

    expect(
      await screen.findByTestId('replace-local-data-notice-status'),
    ).toHaveTextContent('No file was selected. Nothing was changed.');
    expect(
      screen.queryByTestId('confirm-replace-local-data'),
    ).not.toBeOnTheScreen();
  });

  it('reports an invalid file without enabling replacement', async () => {
    await renderScreen({
      parse: () => {
        throw new DataRestoreError('unsupported-format-version');
      },
    });
    await chooseFile();

    expect(
      await screen.findByTestId('replace-local-data-error'),
    ).toHaveTextContent(
      'The selected export uses a format version this app version cannot read.',
    );
    expect(
      screen.queryByTestId('confirm-replace-local-data'),
    ).not.toBeOnTheScreen();
  });

  it('shows what the validated file contains before confirming', async () => {
    await renderScreen();
    await chooseFile();

    expect(
      await screen.findByTestId('replace-local-data-preview'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Nothing has been replaced yet. Review what this file contains, then confirm.',
      ),
    ).toBeOnTheScreen();
  });

  it('says plainly when the chosen file contains no records', async () => {
    await renderScreen({ parse: () => parsed(buildEmptyExport()) });
    await chooseFile();

    expect(
      await screen.findByTestId('replace-local-data-empty-file'),
    ).toHaveTextContent(/This file contains no records\./);
  });

  it('does not warn about an empty file when the export holds records', async () => {
    await renderScreen();
    await chooseFile();
    await screen.findByTestId('replace-local-data-preview');

    expect(
      screen.queryByTestId('replace-local-data-empty-file'),
    ).not.toBeOnTheScreen();
  });

  it('keeps replacement disabled until the recovery decision is resolved', async () => {
    await renderScreen();
    await chooseFile();

    expect(
      await screen.findByTestId('confirm-replace-local-data'),
    ).toBeDisabled();
    expect(
      screen.getByLabelText(
        'Replace all local data. Save a copy of your current information, or confirm you do not want one, first.',
      ),
    ).toBeOnTheScreen();
  });

  it('keeps replacement disabled until the replacement is acknowledged', async () => {
    await renderScreen();
    await chooseFile();
    await declineRecovery();

    expect(screen.getByTestId('confirm-replace-local-data')).toBeDisabled();
    expect(
      screen.getByLabelText(
        'Replace all local data. Confirm you understand everything stored here will be replaced first.',
      ),
    ).toBeOnTheScreen();
  });

  it('enables replacement once both decisions are made', async () => {
    await renderScreen();
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();

    expect(screen.getByTestId('confirm-replace-local-data')).not.toBeDisabled();
  });

  it('offers a copy of the current information and never claims it was saved', async () => {
    await renderScreen();
    await chooseFile();
    await fireEvent.press(
      screen.getByTestId('create-replace-local-data-recovery'),
    );

    expect(
      await screen.findByTestId('replace-local-data-recovery-ready'),
    ).toHaveTextContent(
      /This app cannot tell whether it was saved anywhere else/,
    );
  });

  it('resolves the recovery decision once a copy exists', async () => {
    await renderScreen();
    await chooseFile();
    await fireEvent.press(
      screen.getByTestId('create-replace-local-data-recovery'),
    );
    await screen.findByTestId('replace-local-data-recovery-ready');
    await acknowledgeReplacement();

    expect(
      screen.queryByTestId('acknowledge-no-recovery-export'),
    ).not.toBeOnTheScreen();
    expect(screen.getByTestId('confirm-replace-local-data')).not.toBeDisabled();
  });

  it('reports a neutral status after the share sheet closes', async () => {
    await renderScreen();
    await chooseFile();
    await fireEvent.press(
      screen.getByTestId('create-replace-local-data-recovery'),
    );
    await fireEvent.press(
      await screen.findByTestId('share-replace-local-data-recovery'),
    );

    expect(
      await screen.findByTestId('replace-local-data-notice-status'),
    ).toHaveTextContent(
      'Share options closed. If you did not save the copy, open share options again.',
    );
  });

  it('lets the user continue after a failed recovery copy', async () => {
    await renderScreen({
      createRecoveryExport: () =>
        Promise.reject(new LocalDataReplacementError('recovery-export-failed')),
    });
    await chooseFile();
    await fireEvent.press(
      screen.getByTestId('create-replace-local-data-recovery'),
    );

    expect(
      await screen.findByTestId('replace-local-data-recovery-error'),
    ).toHaveTextContent(
      'A copy of your current information could not be created, so nothing was replaced.',
    );
    await declineRecovery();
    await acknowledgeReplacement();
    expect(screen.getByTestId('confirm-replace-local-data')).not.toBeDisabled();
  });

  it('confirms through a platform alert whose action reads differently', async () => {
    await renderScreen();
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    const alert = await replaceEverything();

    expect(alert.mock.calls[0]?.[0]).toBe('Replace all local data?');
    expect(alertButton(alert, 'destructive')?.text).toBe('Replace everything');
    expect(alertButton(alert, 'cancel')?.text).toBe('Cancel');
  });

  it('replaces nothing when the confirmation is cancelled', async () => {
    let replaceCount = 0;
    await renderScreen({
      replace: () => {
        replaceCount += 1;
        return Promise.resolve();
      },
    });
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    const alert = spyOnAlert();
    await fireEvent.press(screen.getByTestId('confirm-replace-local-data'));
    alertButton(alert, 'cancel')?.onPress?.();

    expect(replaceCount).toBe(0);
    expect(
      screen.queryByTestId('replace-local-data-complete'),
    ).not.toBeOnTheScreen();
  });

  it('confirms completion in a persistent panel', async () => {
    await renderScreen();
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    await replaceEverything();

    expect(
      await screen.findByRole('header', {
        name: 'Your information was replaced',
      }),
    ).toBeOnTheScreen();
  });

  it('says where the recovery copy still is when one was created', async () => {
    await renderScreen();
    await chooseFile();
    await fireEvent.press(
      screen.getByTestId('create-replace-local-data-recovery'),
    );
    await screen.findByTestId('replace-local-data-recovery-ready');
    await acknowledgeReplacement();
    await replaceEverything();

    expect(
      await screen.findByTestId('replace-local-data-recovery-notice'),
    ).toHaveTextContent(/still on this device/);
  });

  it('mentions no recovery copy when the user declined one', async () => {
    await renderScreen();
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    await replaceEverything();

    await screen.findByTestId('replace-local-data-complete');
    expect(
      screen.queryByTestId('replace-local-data-recovery-notice'),
    ).not.toBeOnTheScreen();
  });

  it('says the current information was kept when replacing fails', async () => {
    await renderScreen({
      replace: () =>
        Promise.reject(new LocalDataReplacementError('replace-failed')),
    });
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    await replaceEverything();

    expect(
      await screen.findByTestId('replace-local-data-error'),
    ).toHaveTextContent(/What was already on this device was kept/);
    expect(
      screen.queryByTestId('replace-local-data-complete'),
    ).not.toBeOnTheScreen();
  });

  it('says the current information was kept when verification fails', async () => {
    await renderScreen({
      replace: () =>
        Promise.reject(new LocalDataReplacementError('verification-failed')),
    });
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    await replaceEverything();

    expect(
      await screen.findByTestId('replace-local-data-error'),
    ).toHaveTextContent(/nothing was replaced/);
  });

  it('exposes no internal detail when an unknown failure reaches the screen', async () => {
    await renderScreen({
      replace: () => Promise.reject(new Error('SQLITE_BUSY at /var/db')),
    });
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    await replaceEverything();

    const message = await screen.findByTestId('replace-local-data-error');
    expect(message).toHaveTextContent(
      'Your information could not be replaced. Nothing was changed, so you can try again.',
    );
    expect(message).not.toHaveTextContent('SQLITE_BUSY');
  });

  it('clears every earlier decision when a different file is chosen', async () => {
    await renderScreen();
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    await fireEvent.press(screen.getByTestId('choose-replace-local-data-file'));
    await screen.findByTestId('replace-local-data-preview');

    expect(screen.getByTestId('confirm-replace-local-data')).toBeDisabled();
  });

  it('returns to the application after a successful replacement', async () => {
    let finishCount = 0;
    await renderScreen({ onFinish: () => (finishCount += 1) });
    await chooseFile();
    await declineRecovery();
    await acknowledgeReplacement();
    await replaceEverything();

    await fireEvent.press(
      await screen.findByTestId('finish-replace-local-data'),
    );
    expect(finishCount).toBe(1);
  });
});
