import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppButton } from './AppButton';

describe('AppButton', () => {
  it('exposes a button role and invokes its action', async () => {
    const onPress = jest.fn();
    await render(<AppButton label="Try again" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not invoke its action when disabled', async () => {
    const onPress = jest.fn();
    await render(<AppButton disabled label="Try again" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
