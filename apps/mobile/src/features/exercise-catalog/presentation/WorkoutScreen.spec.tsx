import { fireEvent, render, screen } from '@testing-library/react-native';
import { WorkoutScreen } from './WorkoutScreen';

describe('WorkoutScreen', () => {
  it('presents the Exercise Library without pretending future features exist', async () => {
    const onOpenLibrary = jest.fn();
    await render(<WorkoutScreen onOpenLibrary={onOpenLibrary} />);
    expect(screen.getByText('Exercise Library')).toBeOnTheScreen();
    expect(
      screen.getByText(/Planning and workout sessions are coming later/),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Open Exercise Library' }),
    );
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
  });
});
