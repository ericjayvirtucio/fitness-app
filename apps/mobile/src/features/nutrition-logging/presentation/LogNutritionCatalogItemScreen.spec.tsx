import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  formatLocalCalendarDate,
  formatLocalCalendarDateLabel,
} from '../../../application/date/local-calendar-date';
import { buildNutritionCatalogItem } from '../application/build-nutrition-catalog-item';
import { LogNutritionCatalogItemScreen } from './LogNutritionCatalogItemScreen';

const catalogItemId = '550e8400-e29b-41d4-a716-446655440000';
const pastDay = '2020-01-15';

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalCalendarDate(date);
}

function catalogItem() {
  const result = buildNutritionCatalogItem(catalogItemId, {
    carbohydrateGrams: '2',
    description: 'E2E Oats',
    energyKilocalories: '380',
    fatGrams: '4',
    fiberGrams: '',
    isFavorite: false,
    kind: 'food',
    proteinGrams: '8',
    referenceAmount: '100',
    sodiumMilligrams: '0',
    sugarGrams: '1',
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

/**
 * Created once per test rather than inline in the element. The screen reloads
 * the item whenever its loader identity changes, so a new function per render
 * never settles.
 */
function loader(logFromCatalog: jest.Mock = jest.fn()) {
  const item = catalogItem();
  const useCases = {
    getCatalogItem: { execute: () => Promise.resolve(item) },
    logFromCatalog: { execute: logFromCatalog },
  };
  return () => Promise.resolve(useCases);
}

async function renderScreen(
  logFromCatalog: jest.Mock,
  selectedLocalCalendarDate?: string,
) {
  const view = await render(
    <LogNutritionCatalogItemScreen
      catalogItemId={catalogItemId}
      loadUseCases={loader(logFromCatalog)}
      onDone={jest.fn()}
      {...(selectedLocalCalendarDate ? { selectedLocalCalendarDate } : {})}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('log-catalog-item')).toBeTruthy(),
  );
  return view;
}

describe('LogNutritionCatalogItemScreen', () => {
  it('names today when no day was chosen', async () => {
    await renderScreen(jest.fn());
    expect(screen.getByRole('button', { name: 'Log to today' })).toBeTruthy();
  });

  it('names the day the diary was showing', async () => {
    await renderScreen(jest.fn(), pastDay);
    expect(
      screen.getByRole('button', {
        name: `Log to ${formatLocalCalendarDateLabel(pastDay)}`,
      }),
    ).toBeTruthy();
  });

  it('names today when the chosen day has not happened', async () => {
    await renderScreen(jest.fn(), tomorrow());
    expect(screen.getByRole('button', { name: 'Log to today' })).toBeTruthy();
  });

  it('logs onto the day the diary was showing', async () => {
    const logFromCatalog = jest.fn().mockResolvedValue({ isSuccess: true });
    const view = await renderScreen(logFromCatalog, pastDay);
    await fireEvent.changeText(
      screen.getByLabelText('Consumed amount (grams)'),
      '50',
    );
    await fireEvent.press(screen.getByTestId('log-catalog-item'));
    expect(logFromCatalog).toHaveBeenCalledWith(catalogItemId, '50', pastDay);
    /*
     * Unmounted explicitly. A save settles after the assertion, and leaving it
     * to automatic cleanup lets that update land inside the next test's render.
     */
    await view.unmount();
  });

  it('logs to today as no day at all, so the clock instant is unchanged', async () => {
    const logFromCatalog = jest.fn().mockResolvedValue({ isSuccess: true });
    const view = await renderScreen(logFromCatalog);
    await fireEvent.changeText(
      screen.getByLabelText('Consumed amount (grams)'),
      '50',
    );
    await fireEvent.press(screen.getByTestId('log-catalog-item'));
    expect(logFromCatalog).toHaveBeenCalledWith(catalogItemId, '50', undefined);
    await view.unmount();
  });

  it('states a refusal that carries no field in its own live region', async () => {
    const logFromCatalog = jest.fn().mockResolvedValue({
      error: [
        {
          code: 'invalid-date',
          message: 'Consumption time cannot be in the future.',
        },
      ],
      isSuccess: false,
    });
    const view = await renderScreen(logFromCatalog, pastDay);
    await fireEvent.changeText(
      screen.getByLabelText('Consumed amount (grams)'),
      '50',
    );
    await fireEvent.press(screen.getByTestId('log-catalog-item'));
    expect(
      screen.getByText('Consumption time cannot be in the future.'),
    ).toBeTruthy();
    await view.unmount();
  });
});
