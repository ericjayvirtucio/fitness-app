import { fireEvent, render, screen } from '@testing-library/react-native';
import { NutritionCatalogForm } from './NutritionCatalogForm';

const values = {
  carbohydrateGrams: '2',
  description: 'Chicken adobo',
  energyKilocalories: '200',
  fatGrams: '4',
  fiberGrams: '',
  isFavorite: false,
  kind: 'food',
  proteinGrams: '8',
  provenance: 'provided',
  referenceAmount: '100',
  sodiumMilligrams: '0',
  sugarGrams: '1',
} as const;

describe('NutritionCatalogForm', () => {
  it('uses kind-specific units and exposes an accessible favorite action', async () => {
    const onSave = jest.fn();
    await render(
      <NutritionCatalogForm
        errors={{}}
        initialValues={values}
        isEditing={false}
        isSaving={false}
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByLabelText('Reference amount (grams)')).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText('Add Chicken adobo to favorites'),
    );
    expect(
      screen.getByLabelText('Remove Chicken adobo from favorites'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save reusable item'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ isFavorite: true }),
    );
  });

  it('clears the physical reference when changing dimension', async () => {
    const onSave = jest.fn();
    await render(
      <NutritionCatalogForm
        errors={{}}
        initialValues={values}
        isEditing
        isSaving={false}
        onCancel={jest.fn()}
        onDelete={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.press(screen.getByText('Beverage (milliliters)'));
    expect(
      screen.getByLabelText('Reference amount (milliliters)').props.value,
    ).toBe('');
    expect(screen.getByLabelText('Delete saved item')).toBeTruthy();
  });

  it('renders textual validation and busy state', async () => {
    await render(
      <NutritionCatalogForm
        errors={{ description: 'Nutrition description is required.' }}
        initialValues={{ ...values, description: '' }}
        isEditing={false}
        isSaving
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(
      screen.getByText('Error: Nutrition description is required.'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Save reusable item').props.accessibilityState,
    ).toEqual(expect.objectContaining({ busy: true, disabled: true }));
  });
});
