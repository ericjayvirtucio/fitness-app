import { contrastRatio, relativeLuminance } from './contrast';

describe('contrast ratio', () => {
  it('returns the extremes of the scale for the pairs that define it', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 6);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 6);
    expect(contrastRatio('#22DD55', '#22DD55')).toBeCloseTo(1, 6);
  });

  it('returns the published ratio for a known borderline pair', () => {
    // The lightest gray that still clears 4.5:1 on white, and the value every
    // contrast tool reports for it.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#595959', '#FFFFFF')).toBeCloseTo(7.0, 1);
  });

  it('is symmetric, because a ratio has no foreground', () => {
    expect(contrastRatio('#0A7A2C', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#0A7A2C'),
      6,
    );
  });

  it('reads shorthand notation as the value it abbreviates', () => {
    expect(contrastRatio('#000', '#FFF')).toBeCloseTo(21, 6);
    expect(relativeLuminance('#0f0')).toBeCloseTo(
      relativeLuminance('#00FF00'),
      6,
    );
  });

  it('reads notation in either letter case', () => {
    expect(relativeLuminance('#22dd55')).toBeCloseTo(
      relativeLuminance('#22DD55'),
      6,
    );
  });

  it('places black at no luminance and white at full luminance', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6);
  });

  it('refuses a color it cannot measure rather than assuming one', () => {
    // A translucent color has no ratio until it is composited, and a silent
    // fallback would turn a mistyped token into a passing assertion.
    expect(() => contrastRatio('rgba(0, 0, 0, 0.72)', '#FFFFFF')).toThrow(
      'Not a hexadecimal color: rgba(0, 0, 0, 0.72)',
    );
    expect(() => relativeLuminance('#12345')).toThrow(
      'Not a hexadecimal color: #12345',
    );
    expect(() => relativeLuminance('22DD55')).toThrow(
      'Not a hexadecimal color: 22DD55',
    );
  });
});
