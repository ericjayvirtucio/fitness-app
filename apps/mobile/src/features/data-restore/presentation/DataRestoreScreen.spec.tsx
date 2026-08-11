import { fireEvent, render, screen } from '@testing-library/react-native';
import { DataRestoreError } from '../application/data-restore-error';
import { parseDataExport } from '../application/parse-data-export';
import type {
  ParsedDataExport,
  RestoreData,
} from '../application/restore-data';
import type { DataRestoreFileContents } from '../application/select-data-restore-file-use-case';
import {
  buildExport,
  syntheticToday,
} from '../application/synthetic-data-export.spec-helper';
import { DataRestoreScreen } from './DataRestoreScreen';

const validText = JSON.stringify(buildExport());

function parsedExport(): ParsedDataExport {
  const result = parseDataExport(validText, syntheticToday);
  if (!result.isSuccess) throw new Error('the synthetic export must be valid');
  return result.value;
}

type Overrides = Readonly<{
  isTargetEmpty?: boolean | (() => Promise<boolean>);
  parse?: (text: string) => ParsedDataExport;
  restore?: (data: RestoreData) => Promise<void>;
  select?: () => Promise<DataRestoreFileContents>;
}>;

function renderScreen(overrides: Overrides = {}, onFinish?: () => void) {
  const isTargetEmpty = overrides.isTargetEmpty ?? true;
  return render(
    <DataRestoreScreen
      loadUseCases={() =>
        Promise.resolve({
          getRestoreTarget: {
            execute:
              typeof isTargetEmpty === 'function'
                ? isTargetEmpty
                : () => Promise.resolve(isTargetEmpty),
          },
          parseExport: { execute: overrides.parse ?? (() => parsedExport()) },
          restoreExport: {
            execute: overrides.restore ?? (() => Promise.resolve()),
          },
          selectFile: {
            execute:
              overrides.select ??
              (() => Promise.resolve({ status: 'selected', text: validText })),
          },
        })
      }
      {...(onFinish ? { onFinish } : {})}
    />,
  );
}

async function chooseFile(): Promise<void> {
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Choose file' }),
  );
}

describe('DataRestoreScreen', () => {
  it('explains the limits before anything is selected', async () => {
    await renderScreen();

    expect(
      await screen.findByRole('header', { name: 'Before you restore' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Restoring works only when this app contains no information yet.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• The file is read on this device. This app does not upload it.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Restoring is all or nothing. If it fails, nothing is saved.',
      ),
    ).toBeOnTheScreen();
  });

  it('refuses before a file is chosen when the app already holds data', async () => {
    await renderScreen({ isTargetEmpty: false });

    expect(
      await screen.findByRole('header', {
        name: 'This app already has information',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Choose file' })).toBeNull();
  });

  it('treats a dismissed picker as a neutral outcome', async () => {
    await renderScreen({
      select: () => Promise.resolve({ status: 'cancelled' }),
    });

    await chooseFile();

    expect(
      await screen.findByText('No file was selected. Nothing was changed.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('data-restore-error')).toBeNull();
  });

  it('shows a preview that makes clear nothing has been restored yet', async () => {
    await renderScreen();

    await chooseFile();

    expect(
      await screen.findByRole('header', { name: 'Ready to restore' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Nothing has been restored yet. Review what this file contains, then confirm.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Completed workouts')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Restore my data' }),
    ).toBeOnTheScreen();
  });

  it('reports an unsupported format version safely', async () => {
    await renderScreen({
      parse: () => {
        throw new DataRestoreError('unsupported-format-version');
      },
    });

    await chooseFile();

    expect(await screen.findByTestId('data-restore-error')).toHaveTextContent(
      'The selected export uses a format version this app version cannot read.',
    );
    expect(
      screen.getByRole('button', { name: 'Choose another file' }),
    ).toBeOnTheScreen();
  });

  it('reports an oversized file safely', async () => {
    await renderScreen({
      select: () => Promise.reject(new DataRestoreError('file-too-large')),
    });

    await chooseFile();

    expect(await screen.findByTestId('data-restore-error')).toHaveTextContent(
      'The selected file is larger than this app can restore. Only Fitness App exports up to 25 MB are supported.',
    );
  });

  it('never exposes an internal cause in a failure message', async () => {
    await renderScreen({
      select: () =>
        Promise.reject(new Error('SQL error near /var/mobile/fitness-app.db')),
    });

    await chooseFile();

    const message = await screen.findByTestId('data-restore-error');
    expect(message).toHaveTextContent(
      'The file could not be restored. Nothing was changed.',
    );
    expect(message).not.toHaveTextContent('/var/mobile');
  });

  it('confirms completion in a panel that stays on screen', async () => {
    const onFinish = jest.fn();
    await renderScreen({}, onFinish);

    await chooseFile();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Restore my data' }),
    );

    expect(
      await screen.findByRole('header', { name: 'Restore complete' }),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Back to profile' }),
    );
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('offers no restore control once the target stopped being empty', async () => {
    await renderScreen({
      restore: () => Promise.reject(new DataRestoreError('target-not-empty')),
    });

    await chooseFile();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Restore my data' }),
    );

    expect(
      await screen.findByRole('header', {
        name: 'This app already has information',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Restore my data' }),
    ).toBeNull();
  });

  it('reports a failed restore without claiming anything changed', async () => {
    await renderScreen({
      restore: () => Promise.reject(new DataRestoreError('write-failed')),
    });

    await chooseFile();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Restore my data' }),
    );

    expect(await screen.findByTestId('data-restore-error')).toHaveTextContent(
      'Your information could not be restored. Nothing was changed.',
    );
  });

  it('labels the screen and its controls for assistive technology', async () => {
    await renderScreen();

    expect(await screen.findByLabelText('Restore my data')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Choose file' }),
    ).toBeOnTheScreen();
  });

  it('offers no control until the use cases are ready', async () => {
    await render(
      <DataRestoreScreen loadUseCases={() => new Promise(() => undefined)} />,
    );

    expect(
      screen.getAllByLabelText('Preparing restore').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Choose file' })).toBeNull();
  });
});
