import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppButton, type AppButtonVariant } from './AppButton';

describe('AppButton', () => {
  it.each<AppButtonVariant>([
    'primary',
    'secondary',
    'outline',
    'ghost',
    'danger',
  ])('renders the %s variant as an accessible action', async (variant) => {
    const onPress = jest.fn();
    await render(
      <AppButton label="Continue" onPress={onPress} variant={variant} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes disabled state and does not invoke its action', async () => {
    const onPress = jest.fn();
    await render(<AppButton disabled label="Continue" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Continue' });

    expect(button).toHaveProp('accessibilityState', {
      busy: false,
      disabled: true,
    });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('announces loading and prevents duplicate actions', async () => {
    const onPress = jest.fn();
    await render(
      <AppButton isLoading label="Saving changes" onPress={onPress} />,
    );
    const button = screen.getByRole('button', { name: 'Saving changes' });

    expect(button).toHaveProp('accessibilityState', {
      busy: true,
      disabled: true,
    });
    expect(
      screen.getByText('Saving changes', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses an explicit accessibility label when supplied', async () => {
    await render(
      <AppButton
        accessibilityLabel="Save profile changes"
        label="Save"
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Save profile changes' }),
    ).toBeOnTheScreen();
  });
});
