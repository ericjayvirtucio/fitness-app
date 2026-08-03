import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { HydrationTargetScreen } from './HydrationTargetScreen';

describe('HydrationTargetScreen', () => {
  it('saves a user-entered liter target', async () => {
    const execute = jest.fn(() =>
      Promise.resolve({ isSuccess: true as const, value: {} as never }),
    );
    const onDone = jest.fn();
    await render(
      <HydrationTargetScreen
        loadUseCases={() =>
          Promise.resolve({
            getTarget: { execute: () => Promise.resolve(null) },
            saveTarget: { execute },
          })
        }
        onDone={onDone}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Choose your own tracking target/)).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Liters (L)' }));
    await fireEvent.changeText(screen.getByLabelText('Target (L)'), '3');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save daily target' }),
    );
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({ amount: '3', unit: 'liter' }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('retains input and shows a safe save failure', async () => {
    await render(
      <HydrationTargetScreen
        loadUseCases={() =>
          Promise.resolve({
            getTarget: { execute: () => Promise.resolve(null) },
            saveTarget: {
              execute: () => Promise.reject(new Error('database details')),
            },
          })
        }
        onDone={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Target (mL)')).toBeTruthy(),
    );
    await fireEvent.changeText(screen.getByLabelText('Target (mL)'), '3000');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save daily target' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('Daily target could not be saved. Nothing changed.'),
      ).toBeTruthy(),
    );
    expect(screen.getByDisplayValue('3000')).toBeTruthy();
  });
});
