import { DomainId, HydrationEntry, Volume } from '@fitness/domain';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HydrationEntryScreen } from './HydrationEntryScreen';

const pastDay = '2020-01-15';
const today = formatLocalCalendarDate(new Date());

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalCalendarDate(date);
}

/**
 * The loader is created once per test rather than inline in the element. The
 * screen depends on its identity, so a new function per render would reload the
 * entry on every render and never settle.
 */
function loader(createEntry: jest.Mock = jest.fn()) {
  const useCases = {
    createEntry: { execute: createEntry },
    deleteEntry: { execute: jest.fn() },
    getEntry: { execute: () => Promise.resolve(null) },
    updateEntry: { execute: jest.fn() },
  };
  return () => Promise.resolve(useCases);
}

async function renderScreen(selectedLocalCalendarDate?: string) {
  await render(
    <HydrationEntryScreen
      loadUseCases={loader()}
      onDone={jest.fn()}
      {...(selectedLocalCalendarDate ? { selectedLocalCalendarDate } : {})}
    />,
  );
  await waitFor(() => expect(screen.getByLabelText('Date')).toBeTruthy());
}

function entry() {
  const id = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
  const volume = Volume.create(500, 'milliliter');
  if (!id.isSuccess || !volume.isSuccess) throw new Error('Invalid fixture');
  const result = HydrationEntry.create({
    fluidType: 'plain-water',
    id: id.value,
    localCalendarDate: '2026-08-04',
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes: 480,
    volume: volume.value,
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('HydrationEntryScreen', () => {
  it('prefills today and the current clock when no day was chosen', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Date').props.value).toBe(today);
    expect(screen.getByLabelText('Time').props.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it('prefills the day the hydration screen was showing, at noon', async () => {
    await renderScreen(pastDay);
    expect(screen.getByLabelText('Date').props.value).toBe(pastDay);
    expect(screen.getByLabelText('Time').props.value).toBe('12:00');
  });

  it('prefills today when the chosen day has not happened', async () => {
    await renderScreen(tomorrow());
    expect(screen.getByLabelText('Date').props.value).toBe(today);
  });

  it('prefills today when the chosen day is not a local calendar date', async () => {
    await renderScreen('2026-02-30');
    expect(screen.getByLabelText('Date').props.value).toBe(today);
  });

  it('records onto the day the hydration screen was showing', async () => {
    const createEntry = jest.fn().mockResolvedValue({ isSuccess: true });
    const onDone = jest.fn();
    const view = await render(
      <HydrationEntryScreen
        loadUseCases={loader(createEntry)}
        onDone={onDone}
        selectedLocalCalendarDate={pastDay}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Volume (mL)')).toBeTruthy(),
    );
    await fireEvent.changeText(screen.getByLabelText('Volume (mL)'), '500');
    await fireEvent.press(screen.getByRole('button', { name: 'Save fluid' }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        localCalendarDate: pastDay,
        occurredAtEpochMilliseconds: new Date(2020, 0, 15, 12).getTime(),
      }),
    );
    /*
     * Unmounted explicitly. A save settles after the assertion, and leaving it
     * to automatic cleanup lets that update land inside the next test's render.
     */
    await view.unmount();
  });

  it('requires destructive confirmation before deleting', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    await render(
      <HydrationEntryScreen
        entryId={entry().id.value}
        loadUseCases={() =>
          Promise.resolve({
            createEntry: { execute: jest.fn() },
            deleteEntry: { execute: jest.fn() },
            getEntry: { execute: () => Promise.resolve(entry()) },
            updateEntry: { execute: jest.fn() },
          })
        }
        onDone={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete fluid' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete fluid' }));
    expect(alert).toHaveBeenCalledWith(
      'Delete fluid entry?',
      expect.stringContaining('cannot be undone'),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Cancel' }),
        expect.objectContaining({ style: 'destructive', text: 'Delete' }),
      ]),
    );
    alert.mockRestore();
  });
});
