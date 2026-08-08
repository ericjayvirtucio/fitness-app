import { fireEvent, render, screen } from '@testing-library/react-native';
import { SelectionField } from './SelectionField';

describe('SelectionField', () => {
  it('announces selection and changes through accessible radio controls', async () => {
    const onChange = jest.fn();
    await render(
      <SelectionField
        label="Units"
        onChange={onChange}
        options={[
          { label: 'Metric', value: 'metric' },
          { label: 'Imperial', value: 'imperial' },
        ]}
        value="metric"
      />,
    );

    expect(screen.getByRole('radio', { name: 'Metric' })).toHaveProp(
      'accessibilityState',
      { checked: true },
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Imperial' }));
    expect(onChange).toHaveBeenCalledWith('imperial');
  });

  it('derives stable option identifiers from an explicit field identifier', async () => {
    await render(
      <SelectionField
        label="Units"
        onChange={jest.fn()}
        options={[
          { label: 'Metric', value: 'metric' },
          { label: 'Imperial', value: 'imperial' },
        ]}
        testID="profile-unit-system"
        value="metric"
      />,
    );

    expect(screen.getByTestId('profile-unit-system')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-unit-system-metric')).toHaveProp(
      'accessibilityState',
      { checked: true },
    );
    expect(screen.getByTestId('profile-unit-system-imperial')).toHaveProp(
      'accessibilityState',
      { checked: false },
    );
  });
});
