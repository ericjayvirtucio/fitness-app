import type { ConsumptionEntry } from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import { buildConsumptionEntry } from '../application/build-consumption-entry';
import { ConsumptionEntryScreen } from './ConsumptionEntryScreen';

const pastDay = '2020-01-15';
const today = formatLocalCalendarDate(new Date());

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalCalendarDate(date);
}

function storedEntry() {
  const result = buildConsumptionEntry(
    '550e8400-e29b-41d4-a716-446655440000',
    {
      carbohydrateGrams: '20',
      consumedAmount: '50',
      description: 'Oats',
      energyKilocalories: '200',
      fatGrams: '4',
      fiberGrams: '',
      kind: 'food',
      localCalendarDate: '2026-08-02',
      occurredAtEpochMilliseconds: Date.UTC(2026, 7, 2, 4),
      proteinGrams: '8',
      quantityKind: 'mass',
      referenceAmount: '100',
      sodiumMilligrams: '0',
      sugarGrams: '2',
      utcOffsetMinutes: 480,
    },
    Date.UTC(2026, 7, 2, 5),
  );
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

/**
 * The loader is created once per test rather than inline in the element. The
 * screen depends on its identity, so a new function per render would reload the
 * entry on every render and never settle.
 */
function loader(
  createEntry: jest.Mock = jest.fn(),
  entry: ConsumptionEntry | null = null,
) {
  const useCases = {
    createEntry: { execute: createEntry },
    deleteEntry: { execute: jest.fn() },
    getEntry: { execute: () => Promise.resolve(entry) },
    updateEntry: { execute: jest.fn() },
  };
  return () => Promise.resolve(useCases);
}

async function renderScreen(selectedLocalCalendarDate?: string) {
  await render(
    <ConsumptionEntryScreen
      loadUseCases={loader()}
      onDone={jest.fn()}
      {...(selectedLocalCalendarDate ? { selectedLocalCalendarDate } : {})}
    />,
  );
  await waitFor(() => expect(screen.getByLabelText('Date')).toBeTruthy());
}

describe('ConsumptionEntryScreen', () => {
  it('prefills today and the current clock when no day was chosen', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Date').props.value).toBe(today);
    expect(screen.getByLabelText('Time').props.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it('prefills the day the diary was showing, at noon', async () => {
    await renderScreen(pastDay);
    expect(screen.getByLabelText('Date').props.value).toBe(pastDay);
    expect(screen.getByLabelText('Time').props.value).toBe('12:00');
  });

  it('prefills today when the chosen day has not happened', async () => {
    await renderScreen(tomorrow());
    expect(screen.getByLabelText('Date').props.value).toBe(today);
    expect(screen.getByLabelText('Time').props.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it('prefills today when the chosen day is not a local calendar date', async () => {
    await renderScreen('2026-02-30');
    expect(screen.getByLabelText('Date').props.value).toBe(today);
  });

  it('records onto the day the diary was showing', async () => {
    const createEntry = jest.fn().mockResolvedValue({ isSuccess: true });
    const onDone = jest.fn();
    const view = await render(
      <ConsumptionEntryScreen
        loadUseCases={loader(createEntry)}
        onDone={onDone}
        selectedLocalCalendarDate={pastDay}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Description')).toBeTruthy(),
    );
    await fireEvent.changeText(screen.getByLabelText('Description'), 'Oats');
    await fireEvent.changeText(
      screen.getByLabelText('Reference amount (grams)'),
      '100',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Energy per reference (kcal)'),
      '200',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Consumed amount (grams)'),
      '50',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save entry' }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(createEntry).toHaveBeenCalledTimes(1);
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

  it('keeps an existing entry on its own recorded day', async () => {
    const entry = storedEntry();
    await render(
      <ConsumptionEntryScreen
        entryId={entry.id.value}
        loadUseCases={loader(jest.fn(), entry)}
        onDone={jest.fn()}
        selectedLocalCalendarDate={pastDay}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Date')).toBeTruthy());
    expect(screen.getByLabelText('Date').props.value).toBe('2026-08-02');
    expect(screen.getByLabelText('Time').props.value).toBe('12:00');
  });
});
