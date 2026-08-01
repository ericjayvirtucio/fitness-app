import { render, screen } from '@testing-library/react-native';
import { AppIcon } from './AppIcon';

describe('AppIcon', () => {
  it('is decorative unless given an accessible name', async () => {
    await render(<AppIcon name="heart-outline" />);
    expect(screen.queryByLabelText('Favorite')).not.toBeOnTheScreen();
  });

  it('exposes an explicitly labeled meaningful icon', async () => {
    await render(
      <AppIcon accessibilityLabel="Favorite" name="heart-outline" />,
    );
    expect(screen.getByLabelText('Favorite')).toBeOnTheScreen();
  });
});
