/**
 * WCAG contrast arithmetic over the palette's own notation.
 *
 * The point of this module is that a token pair's contrast is a fact about two
 * strings rather than a fact about a device, so it can be asserted in a unit test
 * instead of inspected by eye. Rendered contrast — after platform compositing,
 * shadows, and opacity — still cannot be, and the design-system README says so.
 *
 * Hexadecimal notation only, and an unparseable value throws rather than
 * resolving to a default. A silent fallback here would turn a mistyped token into
 * a passing assertion, which is the one failure this module exists to prevent.
 * `overlay` is deliberately outside its reach: a translucent color has no ratio
 * until it is composited over something.
 */

const hexadecimalColor = /^#(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i;

function toChannels(color: string): readonly [number, number, number] {
  const match = hexadecimalColor.exec(color);

  if (!match) {
    throw new Error(`Not a hexadecimal color: ${color}`);
  }

  const [shorthand, full] = [match[1], match[2]];
  const digits = full ?? `${shorthand}`.replace(/./g, (digit) => digit + digit);

  return [
    Number.parseInt(digits.slice(0, 2), 16),
    Number.parseInt(digits.slice(2, 4), 16),
    Number.parseInt(digits.slice(4, 6), 16),
  ];
}

function toLinearChannel(channel: number): number {
  const proportion = channel / 255;

  return proportion <= 0.03928
    ? proportion / 12.92
    : ((proportion + 0.055) / 1.055) ** 2.4;
}

/** The WCAG relative luminance of a hexadecimal color, from 0 to 1. */
export function relativeLuminance(color: string): number {
  const [red, green, blue] = toChannels(color).map(toLinearChannel) as [
    number,
    number,
    number,
  ];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * The WCAG contrast ratio between two hexadecimal colors, from 1 to 21.
 *
 * The ratio is symmetric, so the argument order is a readability choice rather
 * than a meaningful one.
 */
export function contrastRatio(foreground: string, background: string): number {
  const luminances = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ];
  const lighter = Math.max(...luminances);
  const darker = Math.min(...luminances);

  return (lighter + 0.05) / (darker + 0.05);
}
