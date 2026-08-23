import { render, screen } from '@testing-library/react-native';
import { AppText } from './AppText';
import { typography } from '../theme/tokens';

describe('AppText', () => {
  it('scales with Dynamic Type by default and wraps rather than shrinking', async () => {
    await render(<AppText>Record explicit fluid volumes offline.</AppText>);

    const text = screen.getByText('Record explicit fluid volumes offline.');
    expect(text).toHaveProp('allowFontScaling', true);
    expect(text).toHaveProp('adjustsFontSizeToFit', false);
    expect(text).not.toHaveProp('numberOfLines');
  });

  it('shrinks a single-line value instead of wrapping or clipping it', async () => {
    // A hero numeral reaches 112px at the largest accessibility size and no card
    // is wide enough to hold it. Shrinking is what keeps it fully visible.
    await render(
      <AppText isSingleLine variant="hero">
        2,450 mL
      </AppText>,
    );

    const value = screen.getByText('2,450 mL');
    expect(value).toHaveProp('adjustsFontSizeToFit', true);
    expect(value).toHaveProp('numberOfLines', 1);
    expect(value).toHaveProp('minimumFontScale', 0.5);
    expect(value).toHaveProp('allowFontScaling', true);
  });

  it('renders the hero step above every other size', async () => {
    expect(typography.hero.fontSize).toBeGreaterThan(
      typography.display.fontSize,
    );

    await render(<AppText variant="hero">1,850 kcal</AppText>);

    expect(screen.getByText('1,850 kcal')).toHaveStyle({
      fontSize: typography.hero.fontSize,
    });
  });
});
