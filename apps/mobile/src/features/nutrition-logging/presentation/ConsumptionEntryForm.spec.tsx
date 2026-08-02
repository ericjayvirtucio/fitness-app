import { render, screen } from '@testing-library/react-native';
import { ConsumptionEntryForm, toSaveInput } from './ConsumptionEntryForm';

const values = {
  carbohydrateGrams: '',
  consumedAmount: '50',
  date: '2026-08-02',
  description: 'Oats',
  energyKilocalories: '200',
  fatGrams: '',
  fiberGrams: '',
  kind: 'food' as const,
  proteinGrams: '',
  quantityKind: 'mass' as const,
  referenceAmount: '100',
  sodiumMilligrams: '0',
  sugarGrams: '',
  time: '12:00',
};

describe('ConsumptionEntryForm', () => {
  it('explains canonical quantities and unknown values accessibly', async () => {
    await render(
      <ConsumptionEntryForm
        errors={{}}
        initialValues={values}
        isSaving={false}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Physical quantity')).toBeTruthy();
    expect(screen.getByLabelText('Reference amount (grams)')).toBeTruthy();
    expect(screen.getByText(/Blank nutrient fields mean unknown/)).toBeTruthy();
  });

  it('converts a valid local wall time and rejects invalid dates', () => {
    expect(toSaveInput(values)?.localCalendarDate).toBe('2026-08-02');
    expect(toSaveInput({ ...values, date: '2026-02-30' })).toBeNull();
  });
});
