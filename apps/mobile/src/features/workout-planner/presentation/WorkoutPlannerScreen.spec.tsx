import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Weekday } from '@fitness/domain';
import { WorkoutPlannerScreen } from './WorkoutPlannerScreen';

jest.mock('expo-router', () => {
  const invokedCallbacks = new WeakSet<() => void>();
  return {
    useFocusEffect: (callback: () => void) => {
      if (!invokedCallbacks.has(callback)) {
        invokedCallbacks.add(callback);
        queueMicrotask(callback);
      }
    },
  };
});

function weekday(value: number) {
  const result = Weekday.create(value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('WorkoutPlannerScreen', () => {
  it('renders a Sunday-to-Saturday plan and preserves Exercise Library access', async () => {
    const onEditDay = jest.fn();
    const onOpenLibrary = jest.fn();
    await render(
      <WorkoutPlannerScreen
        loadUseCases={() =>
          Promise.resolve({
            getWeekly: {
              execute: () =>
                Promise.resolve(
                  Array.from({ length: 7 }, (_, value) => ({
                    kind: 'rest',
                    weekday: weekday(value),
                  })),
                ),
            },
          } as never)
        }
        onEditDay={onEditDay}
        onOpenLibrary={onOpenLibrary}
      />,
    );
    await waitFor(() => expect(screen.getByText('Sunday')).toBeOnTheScreen());
    expect(screen.getByText('Saturday')).toBeOnTheScreen();
    expect(screen.getAllByText('Rest')).toHaveLength(7);
    expect(screen.getByTestId('weekly-plan-screen')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled',
    );
    for (let value = 0; value < 7; value += 1) {
      expect(screen.getByTestId(`weekday-card-${value}`)).toHaveStyle({
        gap: 16,
        minHeight: 44,
      });
      expect(screen.getByTestId(`weekday-card-${value}-spacing`)).toHaveStyle({
        marginTop: 16,
      });
    }
    await fireEvent.press(
      screen.getByRole('button', { name: 'Configure Monday, Rest' }),
    );
    expect(onEditDay).toHaveBeenCalledWith(1);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Open Exercise Library' }),
    );
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
  });

  it('shows a safe retry state', async () => {
    await render(
      <WorkoutPlannerScreen
        loadUseCases={() => Promise.reject(new Error('private details'))}
        onEditDay={jest.fn()}
        onOpenLibrary={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Workout plan unavailable')).toBeOnTheScreen(),
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
