export type SemanticColors = Readonly<{
  accent: string;
  background: string;
  border: string;
  danger: string;
  divider: string;
  focus: string;
  information: string;
  onDanger: string;
  onInformation: string;
  onPrimary: string;
  onSecondary: string;
  onSuccess: string;
  onWarning: string;
  overlay: string;
  primary: string;
  secondary: string;
  skeleton: string;
  success: string;
  surface: string;
  surfaceVariant: string;
  textDisabled: string;
  textPrimary: string;
  textSecondary: string;
  warning: string;
}>;

/**
 * The identity is a set of values rather than a theme abstraction, so a screen
 * inherits it without being edited. Every pair a component actually renders is
 * asserted in `theme.spec.ts`; the two exemptions — surface separation and
 * decoration — are stated there rather than silently skipped.
 *
 * The identity green marks active state, progress, and success. It clears the
 * body-text threshold in both themes, which means the rule that it is not used
 * for body copy is a decision about meaning rather than a workaround: a color
 * that marks a state stops marking it once ordinary sentences are printed in it.
 */
export const lightColors: SemanticColors = {
  accent: '#8A5200',
  background: '#F7F8F7',
  border: '#7E8781',
  danger: '#B3261E',
  divider: '#D5DAD6',
  focus: '#0B57D0',
  information: '#0B57D0',
  onDanger: '#FFFFFF',
  onInformation: '#FFFFFF',
  onPrimary: '#FFFFFF',
  onSecondary: '#08301A',
  onSuccess: '#FFFFFF',
  onWarning: '#FFFFFF',
  overlay: 'rgba(7, 18, 14, 0.56)',
  primary: '#0A7A2C',
  secondary: '#DDF3E2',
  skeleton: '#E2E6E3',
  success: '#0A7A2C',
  surface: '#FFFFFF',
  surfaceVariant: '#EFF1EF',
  textDisabled: '#6B736D',
  textPrimary: '#0B0F0C',
  textSecondary: '#5A625C',
  warning: '#8A5200',
};

/**
 * Dark carries the identity, on a true black page.
 *
 * A filled card separates from that page by 1.21:1, which is the identity
 * working as intended and also its weakest point in bright light. `border` is
 * what makes that acceptable, so it is held to the 3:1 a boundary needs on the
 * lightest surface rather than to whatever looks subtle on black.
 */
export const darkColors: SemanticColors = {
  accent: '#FFC14D',
  background: '#000000',
  border: '#666666',
  danger: '#FF5A4E',
  divider: '#2E2E2E',
  focus: '#8FC5FF',
  information: '#7FB4FF',
  onDanger: '#3B0703',
  onInformation: '#001B3D',
  onPrimary: '#062B12',
  onSecondary: '#7BF7A2',
  onSuccess: '#062B12',
  onWarning: '#2B1A00',
  overlay: 'rgba(0, 0, 0, 0.72)',
  primary: '#22DD55',
  secondary: '#0F2E1A',
  skeleton: '#242424',
  success: '#22DD55',
  surface: '#101010',
  surfaceVariant: '#1A1A1A',
  textDisabled: '#787878',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9A9A',
  warning: '#FFC14D',
};
