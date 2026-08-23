import { Easing, type TextStyle } from 'react-native';

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const typography = {
  /**
   * A hero numeral: the derived number a region exists to state, rather than a
   * field within it. Reserved for one value per screen, so that promoting a
   * second one is a visible decision rather than a drift.
   *
   * At the largest accessibility size this reaches 112px, which no card is wide
   * enough to hold. `AppText`'s `isSingleLine` shrinks it to fit instead of
   * wrapping or clipping, and every hero call site passes it.
   */
  hero: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 62,
  },
  display: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 48,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 38,
  },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  subtitle: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 25 },
  bodySmall: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  button: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
} as const satisfies Readonly<Record<string, TextStyle>>;

export const radii = {
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 24,
  round: 999,
} as const;

export const opacity = {
  disabled: 0.48,
  pressed: 0.76,
  subtle: 0.12,
  visible: 1,
} as const;

export const borderWidths = {
  none: 0,
  thin: 1,
  strong: 2,
} as const;

export const iconSizes = {
  small: 16,
  medium: 20,
  large: 24,
  extraLarge: 32,
} as const;

export const motionDurations = {
  instant: 0,
  fast: 120,
  standard: 200,
  slow: 320,
} as const;

export const motionEasings = {
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  standard: Easing.inOut(Easing.cubic),
} as const;

export const minimumTouchTarget = 44;

export const tabBarHeight = 60;
