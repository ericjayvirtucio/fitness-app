import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { emptyDataExportCounts } from '../application/data-export-contract';
import { DataExportError } from '../application/data-export-error';
import type { DataExportFile } from '../application/data-export-file';
import { DataExportScreen } from './DataExportScreen';

const file: DataExportFile = {
  byteSize: 2_048,
  fileName: 'fitness-app-export-20260811T091504Z.json',
  uri: 'file:///cache/data-export/fitness-app-export-20260811T091504Z.json',
};

const result = {
  counts: { ...emptyDataExportCounts, bodyWeightCheckIns: 2 },
  file,
};

type Overrides = Partial<{
  create: (cancellation: { isCancelled: boolean }) => Promise<typeof result>;
  share: (target: DataExportFile) => Promise<void>;
}>;

function createUseCases(overrides: Overrides = {}) {
  const calls = { clear: 0, create: 0, share: 0 };
  const useCases = {
    clearExports: {
      execute: () => {
        calls.clear += 1;
        return Promise.resolve();
      },
    },
    createExport: {
      execute: (cancellation: { isCancelled: boolean }) => {
        calls.create += 1;
        return overrides.create?.(cancellation) ?? Promise.resolve(result);
      },
    },
    shareExport: {
      execute: (target: DataExportFile) => {
        calls.share += 1;
        return overrides.share?.(target) ?? Promise.resolve();
      },
    },
  };
  return { calls, loadUseCases: () => Promise.resolve(useCases) };
}

/**
 * Keeps one export pending so the busy, cancellation, and unmount states are
 * observable, and honours the cancellation token the screen supplies.
 */
function pendingExport() {
  const tokens: { isCancelled: boolean }[] = [];
  let settle: (() => void) | undefined;
  const overrides: Overrides = {
    create: (cancellation) => {
      tokens.push(cancellation);
      return new Promise<typeof result>((resolve, reject) => {
        settle = () => {
          if (cancellation.isCancelled) {
            reject(new DataExportError('cancelled'));
            return;
          }
          resolve(result);
        };
      });
    },
  };
  // Settling on a timer lets the resulting state update land inside the
  // act-wrapped polling of the following query instead of outside it.
  return {
    finish: () => setTimeout(() => settle?.(), 0),
    overrides,
    tokens,
  };
}

describe('DataExportScreen', () => {
  it('explains what is included and how the file is handled', async () => {
    const { loadUseCases } = createUseCases();

    await render(<DataExportScreen loadUseCases={loadUseCases} />);

    expect(screen.getByText('What is included')).toBeTruthy();
    expect(screen.getByTestId('data-export-privacy-notice')).toBeTruthy();
    expect(
      screen.getByText('• This app does not upload it anywhere.'),
    ).toBeTruthy();
    expect(screen.getByText('• The file is not encrypted.')).toBeTruthy();
    expect(
      screen.getByText(
        '• This file can be restored later, but only into an app that has no information in it yet.',
      ),
    ).toBeTruthy();
  });

  it('removes an earlier export when the screen opens', async () => {
    const { calls, loadUseCases } = createUseCases();

    await render(<DataExportScreen loadUseCases={loadUseCases} />);

    await waitFor(() => {
      expect(calls.clear).toBe(1);
    });
  });

  it('shows a busy state and a cancel control while generating', async () => {
    const pending = pendingExport();
    const { loadUseCases } = createUseCases(pending.overrides);
    await render(<DataExportScreen loadUseCases={loadUseCases} />);

    await fireEvent.press(screen.getByTestId('create-data-export'));

    expect(await screen.findByLabelText('Creating export')).toBeTruthy();
    expect(screen.getByTestId('cancel-data-export')).toBeTruthy();
    expect(screen.getByTestId('create-data-export')).toBeDisabled();
    pending.finish();
    await screen.findByTestId('data-export-ready');
  });

  it('confirms a ready export with its file name, size, and record counts', async () => {
    const { loadUseCases } = createUseCases();
    await render(<DataExportScreen loadUseCases={loadUseCases} />);

    await fireEvent.press(screen.getByTestId('create-data-export'));

    expect(await screen.findByTestId('data-export-ready')).toBeTruthy();
    expect(
      screen.getByText('fitness-app-export-20260811T091504Z.json · 2.0 KB'),
    ).toBeTruthy();
    expect(screen.getByText('Weight check-ins')).toBeTruthy();
    expect(screen.getByTestId('share-data-export')).toBeTruthy();
  });

  it('ignores a repeated request while one export is running', async () => {
    const pending = pendingExport();
    const { calls, loadUseCases } = createUseCases(pending.overrides);
    await render(<DataExportScreen loadUseCases={loadUseCases} />);

    await fireEvent.press(screen.getByTestId('create-data-export'));
    await screen.findByLabelText('Creating export');

    expect(calls.create).toBe(1);
    pending.finish();
    await screen.findByTestId('data-export-ready');
    expect(calls.create).toBe(1);
  });

  it('returns to the idle state when the export is cancelled', async () => {
    const pending = pendingExport();
    const { loadUseCases } = createUseCases(pending.overrides);
    await render(<DataExportScreen loadUseCases={loadUseCases} />);
    await fireEvent.press(screen.getByTestId('create-data-export'));
    await screen.findByLabelText('Creating export');

    await fireEvent.press(screen.getByTestId('cancel-data-export'));
    pending.finish();

    expect(
      await screen.findByText('Export cancelled. Nothing was saved.'),
    ).toBeTruthy();
    expect(screen.getByTestId('create-data-export')).toBeTruthy();
    expect(screen.queryByTestId('data-export-ready')).toBeNull();
  });

  it('reports a failure and offers a retry', async () => {
    let attempts = 0;
    const { loadUseCases } = createUseCases({
      create: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new DataExportError('read-failed'))
          : Promise.resolve(result);
      },
    });
    await render(<DataExportScreen loadUseCases={loadUseCases} />);

    await fireEvent.press(screen.getByTestId('create-data-export'));

    expect(await screen.findByTestId('data-export-error')).toHaveTextContent(
      'Your information could not be read. No export file was created.',
    );
    await fireEvent.press(screen.getByTestId('create-data-export'));
    expect(await screen.findByTestId('data-export-ready')).toBeTruthy();
  });

  it('never claims the file was saved after the share handoff', async () => {
    const { loadUseCases } = createUseCases();
    await render(<DataExportScreen loadUseCases={loadUseCases} />);
    await fireEvent.press(screen.getByTestId('create-data-export'));
    await screen.findByTestId('data-export-ready');

    await fireEvent.press(screen.getByTestId('share-data-export'));

    expect(
      await screen.findByTestId('data-export-handoff-status'),
    ).toHaveTextContent(
      'Share options closed. If you did not save the file, open share options again.',
    );
  });

  it('reports that a device cannot share without discarding the export', async () => {
    const { loadUseCases } = createUseCases({
      share: () => Promise.reject(new DataExportError('sharing-unavailable')),
    });
    await render(<DataExportScreen loadUseCases={loadUseCases} />);
    await fireEvent.press(screen.getByTestId('create-data-export'));
    await screen.findByTestId('data-export-ready');

    await fireEvent.press(screen.getByTestId('share-data-export'));

    expect(
      await screen.findByTestId('data-export-handoff-status'),
    ).toHaveTextContent('This device cannot open share or save options.');
    expect(screen.getByTestId('data-export-ready')).toBeTruthy();
  });

  it('clears the stored export when the user discards it', async () => {
    const { calls, loadUseCases } = createUseCases();
    await render(<DataExportScreen loadUseCases={loadUseCases} />);
    await fireEvent.press(screen.getByTestId('create-data-export'));
    await screen.findByTestId('data-export-ready');

    await fireEvent.press(screen.getByTestId('discard-data-export'));

    await waitFor(() => {
      expect(calls.clear).toBe(2);
    });
    expect(screen.queryByTestId('data-export-ready')).toBeNull();
    expect(screen.getByTestId('create-data-export')).toBeTruthy();
  });

  it('requests cancellation and ignores completion when the screen closes', async () => {
    const pending = pendingExport();
    const { loadUseCases } = createUseCases(pending.overrides);
    const view = await render(<DataExportScreen loadUseCases={loadUseCases} />);
    await fireEvent.press(view.getByTestId('create-data-export'));
    await view.findByLabelText('Creating export');

    await view.unmount();
    pending.finish();

    expect(pending.tokens[0]?.isCancelled).toBe(true);
    await waitFor(() => {
      expect(view.queryByTestId('data-export-ready')).toBeNull();
    });
  });
});
