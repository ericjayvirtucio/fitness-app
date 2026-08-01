import { darkColors, lightColors } from './colors';
import { getAppTheme } from './themes';
import {
  borderWidths,
  iconSizes,
  minimumTouchTarget,
  motionDurations,
  opacity,
  radii,
  spacing,
  typography,
} from './tokens';

describe('design theme', () => {
  it('selects dark appearance only when the system requests dark', () => {
    expect(getAppTheme('dark').colors).toBe(darkColors);
    expect(getAppTheme('dark').isDark).toBe(true);
    expect(getAppTheme('light').colors).toBe(lightColors);
  });

  it('maps semantic colors into the navigation theme', () => {
    const theme = getAppTheme('dark');
    expect(theme.navigationTheme.colors.background).toBe(
      theme.colors.background,
    );
    expect(theme.navigationTheme.colors.primary).toBe(theme.colors.primary);
    expect(theme.navigationTheme.colors.text).toBe(theme.colors.textPrimary);
  });

  it('provides ordered and accessible token contracts', () => {
    expect(spacing.xs).toBeLessThan(spacing.md);
    expect(radii.small).toBeLessThan(radii.extraLarge);
    expect(iconSizes.small).toBeLessThan(iconSizes.extraLarge);
    expect(typography.caption.fontSize).toBeLessThan(
      typography.display.fontSize,
    );
    expect(minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(borderWidths.strong).toBeGreaterThan(borderWidths.thin);
    expect(opacity.disabled).toBeLessThan(opacity.visible);
    expect(motionDurations.fast).toBeLessThan(motionDurations.slow);
  });
});
