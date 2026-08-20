import { Volume } from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import { HydrationDailyScreen } from './HydrationDailyScreen';

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

function volume(amount: number) {
  const result = Volume.create(amount, 'milliliter');
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

/**
 * Created once per test rather than inline in the element. The screen reloads
 * whenever its loader identity changes, so a new function per render never
 * settles.
 */
function emptyDayLoader() {
  const useCases = {
    getDailyHydration: {
      execute: () =>
        Promise.resolve({
          entries: [],
          summary: {
            completionPercentage: null,
            entryCount: 0,
            otherFluidVolume: volume(0),
            plainWaterVolume: volume(0),
            remainingVolume: null,
            targetVolume: null,
            totalFluidVolume: volume(0),
          },
        }),
    },
  };
  return () => Promise.resolve(useCases);
}

describe('HydrationDailyScreen', () => {
  it('shows totals, navigation, and a no-target action', async () => {
    await render(
      <HydrationDailyScreen
        loadUseCases={() =>
          Promise.resolve({
            getDailyHydration: {
              execute: () =>
                Promise.resolve({
                  entries: [],
                  summary: {
                    completionPercentage: null,
                    entryCount: 0,
                    otherFluidVolume: volume(0),
                    plainWaterVolume: volume(0),
                    remainingVolume: null,
                    targetVolume: null,
                    totalFluidVolume: volume(0),
                  },
                }),
            },
          })
        }
        onAdd={jest.fn()}
        onEdit={jest.fn()}
        onSetTarget={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Nothing logged for this day')).toBeTruthy(),
    );
    expect(
      screen.getByLabelText(
        'Daily fluid totals, total 0 mL, plain water 0 mL, other fluids 0 mL, 0 entries',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add fluid' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Set daily target' }),
    ).toBeTruthy();
  });

  it('exposes actual over-target progress in accessible text', async () => {
    await render(
      <HydrationDailyScreen
        loadUseCases={() =>
          Promise.resolve({
            getDailyHydration: {
              execute: () =>
                Promise.resolve({
                  entries: [],
                  summary: {
                    completionPercentage: 133.3,
                    entryCount: 1,
                    otherFluidVolume: volume(0),
                    plainWaterVolume: volume(4_000),
                    remainingVolume: volume(0),
                    targetVolume: volume(3_000),
                    totalFluidVolume: volume(4_000),
                  },
                }),
            },
          })
        }
        onAdd={jest.fn()}
        onEdit={jest.fn()}
        onSetTarget={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('133% complete')).toBeTruthy());
    expect(
      screen.getByLabelText(
        'Daily fluid totals, total 4 L, plain water 4 L, other fluids 0 mL, 1 entry',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Daily fluid target')).toBeTruthy();
    expect(screen.getByText(/Target reached/)).toBeTruthy();
  });

  it('adds to the day it is showing, before and after moving a day', async () => {
    const onAdd = jest.fn();
    const view = await render(
      <HydrationDailyScreen
        loadUseCases={emptyDayLoader()}
        onAdd={onAdd}
        onEdit={jest.fn()}
        onSetTarget={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add fluid' })).toBeTruthy(),
    );

    const today = new Date();
    await fireEvent.press(screen.getByRole('button', { name: 'Add fluid' }));
    expect(onAdd).toHaveBeenLastCalledWith(formatLocalCalendarDate(today));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add first fluid' }),
    );
    expect(onAdd).toHaveBeenLastCalledWith(formatLocalCalendarDate(today));

    await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add fluid' })).toBeTruthy(),
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await fireEvent.press(screen.getByRole('button', { name: 'Add fluid' }));
    expect(onAdd).toHaveBeenLastCalledWith(formatLocalCalendarDate(yesterday));
    /*
     * Unmounted explicitly. Moving a day starts another read, and leaving it to
     * automatic cleanup lets that update land inside the next test's render.
     */
    await view.unmount();
  });

  it('reaches the change-target control the progress card renders', async () => {
    const onSetTarget = jest.fn();
    await render(
      <HydrationDailyScreen
        loadUseCases={() =>
          Promise.resolve({
            getDailyHydration: {
              execute: () =>
                Promise.resolve({
                  entries: [],
                  summary: {
                    completionPercentage: 16.7,
                    entryCount: 1,
                    otherFluidVolume: volume(0),
                    plainWaterVolume: volume(500),
                    remainingVolume: volume(2_500),
                    targetVolume: volume(3_000),
                    totalFluidVolume: volume(500),
                  },
                }),
            },
          })
        }
        onAdd={jest.fn()}
        onEdit={jest.fn()}
        onSetTarget={onSetTarget}
      />,
    );

    await waitFor(() => expect(screen.getByText('17% complete')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', { name: 'Change daily target' }),
    );
    expect(onSetTarget).toHaveBeenCalledTimes(1);
  });
});
