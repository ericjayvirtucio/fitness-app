import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextField } from './TextField';

describe('TextField', () => {
  it('associates its label and helper guidance with the input', async () => {
    await render(
      <TextField
        helperText="Use the name you recognize."
        label="Display name"
        placeholder="Your name"
      />,
    );

    const input = screen.getByLabelText('Display name');
    expect(input).toHaveProp(
      'accessibilityHint',
      'Use the name you recognize.',
    );
    expect(screen.getByText('Use the name you recognize.')).toBeOnTheScreen();
  });

  it('announces validation presentation without relying on color', async () => {
    await render(<TextField error="Name is required" label="Display name" />);

    expect(screen.getByText('Error: Name is required')).toHaveProp(
      'accessibilityLiveRegion',
      'polite',
    );
    expect(screen.getByLabelText('Display name')).toHaveProp(
      'accessibilityHint',
      'Error: Name is required',
    );
  });

  it('exposes disabled state and prevents editing', async () => {
    await render(<TextField isDisabled label="Display name" />);
    const input = screen.getByLabelText('Display name');

    expect(input).toHaveProp('accessibilityState', { disabled: true });
    expect(input).toHaveProp('editable', false);
  });

  it('supports decorative leading and trailing icons', async () => {
    await render(
      <TextField
        label="Search"
        leadingIcon="search-outline"
        trailingIcon="close-outline"
      />,
    );

    expect(screen.getByLabelText('Search')).toBeOnTheScreen();
  });

  it('preserves focus handlers while applying internal focus state', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(
      <TextField label="Display name" onBlur={onBlur} onFocus={onFocus} />,
    );
    const input = screen.getByLabelText('Display name');

    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('exposes a stable touch target for the complete input frame', async () => {
    await render(<TextField label="Display name" testID="display-name" />);

    expect(screen.getByTestId('display-name-touch-target')).toHaveProp(
      'accessible',
      false,
    );
    expect(screen.getByTestId('display-name')).toBeOnTheScreen();
  });
});
