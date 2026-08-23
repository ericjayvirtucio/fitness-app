import { darkColors, lightColors, type SemanticColors } from './colors';
import { contrastRatio } from './contrast';
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
    expect(typography.display.fontSize).toBeLessThan(typography.hero.fontSize);
    expect(minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(borderWidths.strong).toBeGreaterThan(borderWidths.thin);
    expect(opacity.disabled).toBeLessThan(opacity.visible);
    expect(motionDurations.fast).toBeLessThan(motionDurations.slow);
  });
});

/**
 * The contrast contract, asserted pair by pair.
 *
 * A pair is listed here because a component renders it, not because the roles
 * sound related. An aggregate assertion over every combination would either fail
 * on pairs nothing draws or pass by averaging away the one that matters.
 *
 * Two exemptions are deliberate, and stated rather than skipped silently:
 *
 * - `surface` and `surfaceVariant` are backgrounds behind text rather than
 *   foregrounds. Their separation from `background` is a tonal hint — 1.21:1 for
 *   a filled card on black — and `Card`'s outlined variant is the mitigation, not
 *   a ratio.
 * - `divider` and `skeleton` carry nothing a person reads. `Divider` declares
 *   `accessibilityRole="none"` for that reason.
 *
 * One limitation is real and recorded in the design-system README: no single
 * `focus` value clears 3:1 against both the page and every fill a ring can be
 * drawn on. `AppButton` draws its ring at the component's outer edge, whose
 * adjacent color is the page, so `focus` is asserted against the pages only.
 */

const bodyTextThreshold = 4.5;
const userInterfaceThreshold = 3;

type Role = keyof SemanticColors;

const backgroundRoles = ['background', 'surface', 'surfaceVariant'] as const;

/** Roles `AppText`, `AppIcon`, and the tab bar render as foreground content. */
const bodyTextRoles: readonly Role[] = [
  'accent',
  'danger',
  'information',
  'primary',
  'success',
  'textPrimary',
  'textSecondary',
  'warning',
];

/** Boundaries and indicators, held to WCAG 1.4.11 rather than to a text rule. */
const boundaryRoles: readonly Role[] = ['border', 'focus'];

/** Each filled control's label against the fill it sits on. */
const onColorPairs: readonly (readonly [Role, Role])[] = [
  ['onDanger', 'danger'],
  ['onInformation', 'information'],
  ['onPrimary', 'primary'],
  ['onSecondary', 'secondary'],
  ['onSuccess', 'success'],
  ['onWarning', 'warning'],
];

const palettes: readonly (readonly [string, SemanticColors])[] = [
  ['light', lightColors],
  ['dark', darkColors],
];

describe.each(palettes)('%s palette', (_appearance, colors) => {
  it('defines every semantic role', () => {
    const roles = Object.keys(colors) as readonly Role[];

    expect(roles).toHaveLength(24);
    for (const role of roles) {
      expect(colors[role]).not.toBe('');
    }
  });

  describe.each(backgroundRoles)('on %s', (backgroundRole) => {
    it.each(bodyTextRoles)('reads %s at body-text contrast', (role) => {
      expect(
        contrastRatio(colors[role], colors[backgroundRole]),
      ).toBeGreaterThanOrEqual(bodyTextThreshold);
    });

    it.each(boundaryRoles)('separates %s as a boundary', (role) => {
      expect(
        contrastRatio(colors[role], colors[backgroundRole]),
      ).toBeGreaterThanOrEqual(userInterfaceThreshold);
    });

    /*
     * WCAG exempts disabled controls entirely. Holding this to 3:1 anyway is a
     * choice: a person reading a disabled field still has to know what it says.
     */
    it('reads textDisabled at boundary contrast despite the exemption', () => {
      expect(
        contrastRatio(colors.textDisabled, colors[backgroundRole]),
      ).toBeGreaterThanOrEqual(userInterfaceThreshold);
    });
  });

  it.each(onColorPairs)('reads %s on %s', (foreground, background) => {
    expect(
      contrastRatio(colors[foreground], colors[background]),
    ).toBeGreaterThanOrEqual(bodyTextThreshold);
  });

  /*
   * `SelectionField` fills a selected option with `secondary` and labels it with
   * the default text color rather than with `onSecondary`. That pair reached
   * 1.53:1 in the previous dark palette, which made a selected filter, period, or
   * unit unreadable on every screen carrying one.
   */
  it('reads a selected option label on its own fill', () => {
    expect(
      contrastRatio(colors.textPrimary, colors.secondary),
    ).toBeGreaterThanOrEqual(bodyTextThreshold);
  });
});
