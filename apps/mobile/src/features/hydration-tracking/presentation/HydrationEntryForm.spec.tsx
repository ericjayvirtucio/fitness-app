import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  HydrationEntryForm,
  toHydrationSaveInput,
  type HydrationEntryFormValues,
} from './HydrationEntryForm';

const values: HydrationEntryFormValues = {
  date: '2026-08-04',
  description: '',
  fluidType: 'plain-water',
  time: '12:00',
  volumeMilliliters: '',
};

describe('HydrationEntryForm', () => {
  it('supports explicit presets and custom milliliters', async () => {
    const onSave = jest.fn();
    await render(
      <HydrationEntryForm
        errors={{}}
        initialValues={values}
        isSaving={false}
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '500 mL' }));
    expect(screen.getByDisplayValue('500')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Volume (mL)'), '625');
    await fireEvent.press(screen.getByRole('button', { name: 'Save fluid' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ volumeMilliliters: '625' }),
    );
  });

  it('reveals an optional description only for another fluid', async () => {
    await render(
      <HydrationEntryForm
        errors={{}}
        initialValues={values}
        isSaving={false}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.queryByLabelText('Description')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Other fluid' }));
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('creates captured local-day input and rejects invalid wall time', () => {
    const input = toHydrationSaveInput({
      ...values,
      description: ' Tea ',
      fluidType: 'other-fluid',
      volumeMilliliters: '350',
    });
    expect(input).toMatchObject({
      description: ' Tea ',
      localCalendarDate: '2026-08-04',
      volumeMilliliters: '350',
    });
    expect(toHydrationSaveInput({ ...values, time: '25:00' })).toBeNull();
  });
});
