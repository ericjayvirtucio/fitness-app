import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import type { LocalDataErasureResult } from '../application/erase-local-data-use-case';
import { LocalDataErasureError } from '../application/local-data-erasure-error';
import { DeleteLocalDataScreen } from './DeleteLocalDataScreen';

type Overrides = Readonly<{
  erase?: () => Promise<LocalDataErasureResult>;
  hasStoredData?: boolean | (() => Promise<boolean>);
  onFinish?: () => void;
  onOpenDataExport?: () => void;
}>;

function renderScreen(overrides: Overrides = {}) {
  const hasStoredData = overrides.hasStoredData ?? true;
  return render(
    <DeleteLocalDataScreen
      loadUseCases={() =>
        Promise.resolve({
          eraseLocalData: {
            execute:
              overrides.erase ??
              (() => Promise.resolve({ isCleanupComplete: true })),
          },
          getLocalDataPresence: {
            execute:
              typeof hasStoredData === 'function'
                ? hasStoredData
                : () => Promise.resolve(hasStoredData),
          },
        })
      }
      {...(overrides.onFinish ? { onFinish: overrides.onFinish } : {})}
      {...(overrides.onOpenDataExport
        ? { onOpenDataExport: overrides.onOpenDataExport }
        : {})}
    />,
  );
}

async function acknowledge(): Promise<void> {
  await fireEvent.press(
    await screen.findByTestId('acknowledge-delete-local-data'),
  );
}

/** Typed so the confirmation's own buttons can be pressed without a cast. */
type AlertSpy = jest.SpyInstance<void, Parameters<typeof Alert.alert>>;

function alertButton(alert: AlertSpy, style: AlertButton['style']) {
  return alert.mock.calls[0]?.[2]?.find((button) => button.style === style);
}

async function pressAlertButton(
  alert: AlertSpy,
  style: AlertButton['style'],
): Promise<void> {
  await act(() => {
    alertButton(alert, style)?.onPress?.();
  });
}

function spyOnAlert(): AlertSpy {
  return jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
}

async function deleteEverything(): Promise<AlertSpy> {
  const alert = spyOnAlert();
  await acknowledge();
  await fireEvent.press(screen.getByTestId('confirm-delete-local-data'));
  await pressAlertButton(alert, 'destructive');
  return alert;
}

describe('DeleteLocalDataScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('explains what is deleted and what is not, before anything happens', async () => {
    await renderScreen();

    expect(
      await screen.findByRole('header', { name: 'What is deleted' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Exercises, your weekly plan, and any workout in progress',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'What is not deleted' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Export files you already saved somewhere else. This app cannot reach them.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Anything in the cloud. This app has no account and stores nothing online.',
      ),
    ).toBeOnTheScreen();
  });

  it('offers an export first without requiring one', async () => {
    const onOpenDataExport = jest.fn();
    await renderScreen({ onOpenDataExport });

    await fireEvent.press(
      await screen.findByTestId('export-before-delete-local-data'),
    );

    expect(onOpenDataExport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('confirm-delete-local-data')).toBeOnTheScreen();
  });

  it('keeps the destructive control disabled until the user acknowledges', async () => {
    await renderScreen();

    expect(
      await screen.findByTestId('confirm-delete-local-data'),
    ).toBeDisabled();

    await acknowledge();

    expect(screen.getByTestId('confirm-delete-local-data')).toBeEnabled();
  });

  it('keeps the destructive control named and disabled when nothing is stored', async () => {
    await renderScreen({ hasStoredData: false });

    expect(
      await screen.findByTestId('delete-local-data-empty'),
    ).toHaveTextContent(
      'This app is not storing any information yet, so there is nothing to delete.',
    );
    await acknowledge();
    const control = screen.getByTestId('confirm-delete-local-data');
    expect(control).toBeDisabled();
    expect(control).toHaveTextContent('Delete all local data');
  });

  it('asks for a destructive confirmation before deleting anything', async () => {
    const erase = jest.fn(() => Promise.resolve({ isCleanupComplete: true }));
    const alert = spyOnAlert();
    await renderScreen({ erase });

    await acknowledge();
    await fireEvent.press(screen.getByTestId('confirm-delete-local-data'));

    expect(alert).toHaveBeenCalledWith(
      'Delete all local data?',
      expect.stringContaining('cannot be undone'),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Cancel' }),
        expect.objectContaining({
          style: 'destructive',
          text: 'Delete everything',
        }),
      ]),
    );
    expect(erase).not.toHaveBeenCalled();
  });

  it('changes nothing when the confirmation is cancelled', async () => {
    const erase = jest.fn(() => Promise.resolve({ isCleanupComplete: true }));
    const alert = spyOnAlert();
    await renderScreen({ erase });

    await acknowledge();
    await fireEvent.press(screen.getByTestId('confirm-delete-local-data'));
    await pressAlertButton(alert, 'cancel');

    expect(erase).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-local-data-complete')).toBeNull();
  });

  it('confirms completion in a panel that stays on screen', async () => {
    const onFinish = jest.fn();
    await renderScreen({ onFinish });

    await deleteEverything();

    expect(
      await screen.findByRole('header', {
        name: 'Everything on this device was deleted',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByTestId('delete-local-data-cleanup-warning'),
    ).toBeNull();
    await fireEvent.press(screen.getByTestId('finish-delete-local-data'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('reports a leftover export file alongside a successful deletion', async () => {
    await renderScreen({
      erase: () => Promise.resolve({ isCleanupComplete: false }),
    });

    await deleteEverything();

    expect(
      await screen.findByTestId('delete-local-data-cleanup-warning'),
    ).toHaveTextContent(
      'An export file this app created is still on this device. It will be removed the next time you open Export my data.',
    );
    expect(
      screen.getByRole('header', {
        name: 'Everything on this device was deleted',
      }),
    ).toBeOnTheScreen();
  });

  it('reports a failed deletion and allows another attempt', async () => {
    await renderScreen({
      erase: () => Promise.reject(new LocalDataErasureError('erase-failed')),
    });

    await deleteEverything();

    expect(
      await screen.findByTestId('delete-local-data-error'),
    ).toHaveTextContent(
      'Your information could not be deleted. Nothing was changed, so you can try again.',
    );
    expect(screen.getByTestId('confirm-delete-local-data')).toBeEnabled();
    expect(screen.queryByTestId('delete-local-data-complete')).toBeNull();
  });

  it('never exposes an internal cause in a failure message', async () => {
    await renderScreen({
      erase: () =>
        Promise.reject(
          new Error('SQL error near DELETE FROM /var/mobile/fitness-app.db'),
        ),
    });

    await deleteEverything();

    const message = await screen.findByTestId('delete-local-data-error');
    expect(message).toHaveTextContent(
      'Your information could not be deleted. Nothing was changed, so you can try again.',
    );
    expect(message).not.toHaveTextContent('/var/mobile');
    expect(message).not.toHaveTextContent('DELETE FROM');
  });

  it('reports storage that could not be checked without offering deletion', async () => {
    await renderScreen({
      hasStoredData: () =>
        Promise.reject(new LocalDataErasureError('storage-unavailable')),
    });

    expect(
      await screen.findByTestId('delete-local-data-error'),
    ).toHaveTextContent(
      'This app could not check its local storage, so nothing was deleted.',
    );
  });

  it('offers no cancellation and no second attempt once deleting has begun', async () => {
    await renderScreen({ erase: () => new Promise(() => undefined) });

    await deleteEverything();

    expect(
      await screen.findByLabelText('Deleting local data'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('confirm-delete-local-data')).toBeDisabled();
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.queryByTestId('export-before-delete-local-data')).toBeNull();
  });

  it('labels the screen and its destructive control for assistive technology', async () => {
    await renderScreen();

    expect(
      await screen.findByLabelText('Delete all local data'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Delete all local data. Confirm you understand this cannot be undone first.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('checkbox', {
        checked: false,
        name: 'I understand this cannot be undone in the app.',
      }),
    ).toBeOnTheScreen();

    await acknowledge();

    expect(
      screen.getByRole('checkbox', {
        checked: true,
        name: 'I understand this cannot be undone in the app.',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Delete all local data' }),
    ).toBeEnabled();
  });

  it('offers no control until the use cases are ready', async () => {
    await render(
      <DeleteLocalDataScreen
        loadUseCases={() => new Promise(() => undefined)}
      />,
    );

    expect(
      screen.getAllByLabelText('Preparing deletion').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId('confirm-delete-local-data')).toBeNull();
  });
});
