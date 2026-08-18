import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { WorkoutResult } from '@fitness/domain';
import { WorkoutSetForm } from './WorkoutSetForm';

describe('WorkoutSetForm', () => {
  it('shows only the fields for external load and saves a confirmed result', async () => {
    const onSave = jest.fn<Promise<void>, [WorkoutResult]>(() =>
      Promise.resolve(),
    );
    await render(
      <WorkoutSetForm
        loggingMode="external-load-and-repetitions"
        onCancel={jest.fn()}
        onSave={onSave}
        unitSystem="metric"
      />,
    );
    expect(screen.getByLabelText('Weight (kg)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Repetitions')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Duration (seconds)')).not.toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '60');
    await fireEvent.changeText(screen.getByLabelText('Repetitions'), '8');
    await fireEvent.press(screen.getByRole('button', { name: 'Save Set' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      repetitions: 8,
      resistance: { grams: 60_000 },
    });
  });

  it('labels assisted resistance accurately and retains invalid input', async () => {
    await render(
      <WorkoutSetForm
        loggingMode="assistance-and-repetitions"
        onCancel={jest.fn()}
        onSave={jest.fn()}
        unitSystem="metric"
      />,
    );
    await fireEvent.changeText(screen.getByLabelText('Assistance (kg)'), 'bad');
    await fireEvent.changeText(screen.getByLabelText('Repetitions'), '8');
    await fireEvent.press(screen.getByRole('button', { name: 'Save Set' }));
    expect(
      screen.getByText('Enter valid values for this set.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Assistance (kg)')).toHaveProp('value', 'bad');
  });

  /**
   * The field's visible label and its accessible name are the same words, so a
   * text selector cannot say which of the two an end-to-end step meant. The
   * repetitions field already carries an identifier for the same reason.
   */
  it('identifies the resistance field however the mode labels it', async () => {
    const { rerender } = await render(
      <WorkoutSetForm
        loggingMode="assistance-and-repetitions"
        onCancel={jest.fn()}
        onSave={jest.fn()}
        unitSystem="metric"
      />,
    );
    expect(screen.getByTestId('workout-set-resistance-input')).toHaveProp(
      'accessibilityLabel',
      'Assistance (kg)',
    );

    await rerender(
      <WorkoutSetForm
        loggingMode="external-load-and-repetitions"
        onCancel={jest.fn()}
        onSave={jest.fn()}
        unitSystem="imperial"
      />,
    );

    expect(screen.getByTestId('workout-set-resistance-input')).toHaveProp(
      'accessibilityLabel',
      'Weight (lb)',
    );
  });
});
