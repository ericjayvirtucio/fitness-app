import { fireEvent, render, screen } from '@testing-library/react-native';
import { RouteErrorFallback } from './RouteErrorFallback';

describe('RouteErrorFallback', () => {
  it('shows a safe message and retries without exposing error details', async () => {
    const retry = jest.fn();
    await render(
      <RouteErrorFallback
        error={new Error('private diagnostic')}
        retry={retry}
      />,
    );

    expect(
      screen.getByRole('header', { name: 'Something went wrong' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('private diagnostic')).not.toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Try loading the screen again' }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
