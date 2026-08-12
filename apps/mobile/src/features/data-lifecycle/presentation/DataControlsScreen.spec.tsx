import { fireEvent, render, screen } from '@testing-library/react-native';
import { DataControlsScreen } from './DataControlsScreen';

describe('DataControlsScreen', () => {
  it('offers exporting, restoring, replacing, and deleting in one place', async () => {
    await render(
      <DataControlsScreen
        onOpenDataExport={jest.fn()}
        onOpenDataRestore={jest.fn()}
        onOpenLocalDataDeletion={jest.fn()}
        onOpenLocalDataReplacement={jest.fn()}
      />,
    );

    expect(
      await screen.findByRole('button', { name: 'Export my data' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Restore my data' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Replace local data from an export',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Delete all local data' }),
    ).toBeOnTheScreen();
  });

  it('says that nothing here reaches a copy saved elsewhere or a cloud account', async () => {
    await render(<DataControlsScreen />);

    expect(
      await screen.findByRole('header', { name: 'What you can do here' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Deleting removes everything stored on this device. Files you already saved elsewhere are not deleted.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Replacing swaps everything stored on this device for a file this app exported. It does not combine the two.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Everything here happens on this device. This app has no account and stores nothing in the cloud.',
      ),
    ).toBeOnTheScreen();
  });

  it('opens each destination from its own control', async () => {
    const onOpenDataExport = jest.fn();
    const onOpenDataRestore = jest.fn();
    const onOpenLocalDataDeletion = jest.fn();
    const onOpenLocalDataReplacement = jest.fn();
    await render(
      <DataControlsScreen
        onOpenDataExport={onOpenDataExport}
        onOpenDataRestore={onOpenDataRestore}
        onOpenLocalDataDeletion={onOpenLocalDataDeletion}
        onOpenLocalDataReplacement={onOpenLocalDataReplacement}
      />,
    );

    await fireEvent.press(await screen.findByTestId('open-data-export'));
    await fireEvent.press(screen.getByTestId('open-data-restore'));
    await fireEvent.press(screen.getByTestId('open-replace-local-data'));
    await fireEvent.press(screen.getByTestId('open-delete-local-data'));

    expect(onOpenDataExport).toHaveBeenCalledTimes(1);
    expect(onOpenDataRestore).toHaveBeenCalledTimes(1);
    expect(onOpenLocalDataReplacement).toHaveBeenCalledTimes(1);
    expect(onOpenLocalDataDeletion).toHaveBeenCalledTimes(1);
  });

  it('labels the screen for assistive technology', async () => {
    await render(<DataControlsScreen />);

    expect(await screen.findByLabelText('Data controls')).toBeOnTheScreen();
  });
});
