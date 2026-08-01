import { render, screen } from '@testing-library/react-native';
import { ApplicationShellScreen } from './ApplicationShellScreen';

describe('ApplicationShellScreen', () => {
  it('renders an accessible empty destination', async () => {
    await render(
      <ApplicationShellScreen
        description="Available in a later phase."
        title="Today"
      />,
    );

    expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Today. Available in a later phase.'),
    ).toBeOnTheScreen();
  });
});
