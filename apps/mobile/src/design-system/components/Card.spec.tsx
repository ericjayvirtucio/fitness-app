import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppText } from './AppText';
import { Card, describeCardContents, type CardVariant } from './Card';

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

  it('groups a labelled static card into one accessibility element', async () => {
    await render(
      <Card accessibilityLabel="Daily totals, 89 kcal" testID="totals">
        <AppText>89 kcal</AppText>
      </Card>,
    );

    const card = screen.getByTestId('totals');
    expect(card).toHaveProp('accessible', true);
    expect(card).toHaveProp('accessibilityLabel', 'Daily totals, 89 kcal');
  });

  it('leaves an unlabelled static card ungrouped so its children stay reachable', async () => {
    await render(
      <Card testID="totals">
        <AppText>89 kcal</AppText>
      </Card>,
    );

    expect(screen.getByTestId('totals')).toHaveProp('accessible', false);
  });
});

describe('describeCardContents', () => {
  it('announces the identity followed by every line the card renders', () => {
    expect(
      describeCardContents('Daily nutrition totals', [
        '89 kcal',
        '1 entry',
        'Protein: 1.1 g',
      ]),
    ).toBe('Daily nutrition totals, 89 kcal, 1 entry, Protein: 1.1 g');
  });

  it('announces the identity alone when the card renders no lines', () => {
    expect(describeCardContents('Daily nutrition totals', [])).toBe(
      'Daily nutrition totals',
    );
  });
});
