import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppText } from './AppText';
import { Card, type CardVariant } from './Card';

describe('Card', () => {
  it.each<CardVariant>(['filled', 'outlined', 'elevated'])(
    'renders static %s content without implying interaction',
    async (variant) => {
      await render(
        <Card variant={variant}>
          <AppText>Summary</AppText>
        </Card>,
      );
      expect(screen.getByText('Summary')).toBeOnTheScreen();
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    },
  );

  it('exposes and invokes an interactive card', async () => {
    const onPress = jest.fn();
    await render(
      <Card accessibilityLabel="Open summary" onPress={onPress}>
        <AppText>Summary</AppText>
      </Card>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Open summary' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
