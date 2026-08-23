# Mobile design system

The mobile design system defines the application's visual identity — one
saturated green that marks active state, progress, and success, on a true black
page in dark appearance and a near-white one in light — and the accessible
building blocks used by product features. Its public API is `index.ts`; code
outside this directory should import from that boundary rather than component or
theme implementation files.

## Theme architecture

`useAppTheme()` follows the device light or dark appearance. There is no stored
manual override or additional theme provider. `getAppTheme()` is the pure,
deterministic selector used by the hook and tests. The same semantic theme is
mapped into React Navigation at the root layout.

Colors describe purpose instead of pigment. Use roles such as `primary`,
`surface`, `textSecondary`, or `danger`; do not add palette names or repeated
hex values to feature code. Both light and dark themes must define every role.

The public token scales cover typography, spacing, radius, elevation, opacity,
border width, icon size, motion, and minimum touch targets. Choose the closest
existing semantic value before adding one. A new token requires a repeated,
reviewed need rather than a one-off visual preference.

`typography.hero` is the top of the type scale and is reserved for one derived
value per screen — the number that screen exists to state. Pass `isSingleLine` to
`AppText` with it: at the largest accessibility size a hero numeral reaches 112px,
and shrinking is what keeps it fully visible instead of wrapping or clipping. A
sentence never opts in, because shrinking prose defeats the setting that asked for
larger text.

## Components

- `AppText` applies semantic typography and text colors while preserving
  Dynamic Type.
- `AppIcon` is the only icon entry point and wraps the existing Ionicons set.
  Icons are decorative unless given an accessibility label.
- `AppButton` supports primary, secondary, outline, ghost, and danger actions,
  along with disabled and loading states.
- `TextField` presents labels, helper or error text, disabled state, icons, and
  native keyboard configuration. It does not perform business validation.
- `Card` supports filled, outlined, and elevated presentation. Supplying
  `onPress` gives it button semantics; static cards do not imply interaction.
  Choose the variant by what the card's edge must do, never by preference — see
  the rule below.
- `Surface` is a neutral themed container. Use `Card` when card semantics and
  variants are intended.
- `Screen` owns safe-area padding and can be scrollable, centered, static, or
  keyboard-aware. Scrollable is the safe default for large text.
- `Divider`, `LoadingIndicator`, `EmptyState`, and `SectionHeader` cover their
  named presentation consistently without adding feature behavior.
- `SelectionField` presents a labeled set of mutually exclusive radio options,
  selected state, wrapping layout, and validation feedback.
- `StatTile` presents one labeled derived value as a dense `row` or an emphasized
  `stacked` block. It is a single accessibility element announcing
  `label, value`, and `describeStatTile` composes that same sentence for a
  labelled card that holds tiles.

### Choosing a card variant

The dark background is true black and a filled card separates from it by 1.21:1.
That is a tonal hint rather than a boundary, and it is deliberate: the identity
separates surfaces by lightness instead of by rules and shadows. `elevated` adds
`elevations.raised`, whose shadow color is `overlay`, so a black shadow on a black
page renders nothing and `elevated` separates no better than `filled` in dark
appearance.

A card's variant therefore states what its edge is for:

- **`outlined`** when the edge carries meaning — the card is pressable, the card
  holds a control or a destructive action, or the card sits directly beside a
  sibling of the same kind and its contents would be ambiguous without a
  boundary.
- **`filled`** only for a card whose edge carries nothing, such as a standalone
  non-interactive block of explanation.
- **`elevated`** for emphasis in light appearance. It is never a boundary, and in
  dark appearance it is a filled card.

Example:

```tsx
import { AppButton, AppText, Card, Screen, spacing } from '../../design-system';

export function ExampleScreen() {
  return (
    <Screen contentContainerStyle={{ gap: spacing.lg }}>
      <AppText accessibilityRole="header" variant="heading">
        Example
      </AppText>
      <Card variant="outlined">
        <AppText color="secondary">Supporting content</AppText>
        <AppButton label="Continue" onPress={() => undefined} />
      </Card>
    </Screen>
  );
}
```

## Accessibility

Give interactive controls concise names that describe their result. Keep
important text visible at large Dynamic Type sizes, and avoid fixed-height text
containers. Do not use color alone for errors, loading, selection, or status.
Meaningful standalone icons require labels; icons accompanying labeled controls
remain decorative. Prefer native focus order and interaction behavior.

Component tests verify semantic roles, names, state, and behavior, and
`theme.spec.ts` proves the contrast of every token pair a component renders —
4.5:1 for text and on-color pairs, 3:1 for boundaries and indicators — using
`contrastRatio`. Adding a role, or a component that renders a new pair, means
adding its assertion in the same change.

That covers the values, not the device. Before shipping a screen, still inspect
light and dark appearance, large text, keyboard behavior, VoiceOver on iOS, and
TalkBack on Android. Automated component tests cannot prove rendered contrast
after platform compositing and opacity, shadow rendering, or
assistive-technology quality.

One known gap: no single `focus` value clears 3:1 against both the page and every
fill a focus ring can be drawn on, so a ring on a `primary` button separates from
the page and not from the fill beneath it. Rings are drawn at a component's outer
edge, whose adjacent color is the page, and that is the pair asserted. A two-tone
indicator is the remedy when a change owns those components.

### Automation identifiers

Accessible names describe controls to people; `testID` identifies a stable
automation anchor. Prefer visible outcomes and accessibility semantics. Add a
`testID` only when repeated, dynamic, localized, or platform-specific native
structure would make that selector ambiguous or brittle.

Use kebab-case product language such as `hydration-add-entry`. Do not encode
user-entered values, fitness data, generated database identifiers, or list
positions. A published identifier is a test contract and should be renamed only
with its consumers. `AppButton`, `TextField`, `Card`, and `Screen` forward native
identifiers. `SelectionField` also derives `<field-id>-<option-value>` identifiers
for its radio options.

## Extending the system

Add a component only when an approved product use case demonstrates reuse.
Keep its API semantic and narrow, compose existing primitives, export it from
`index.ts`, and add behavior-focused tests. Update this document when the public
contract changes. Do not add catch-all style props, a second icon set, business
rules, or feature-specific copy to the design system.

Demonstrated means found in the screens, not in a proposal. `StatTile` entered
because two feature slices had each already written it. Nine components were
proposed together and eight did not enter: three had no consumer anywhere, two had
no data to draw, one had a single consumer whose working surface it would have
rewritten, one changed input semantics rather than appearance, and one belonged to
a later product phase. A component with one consumer belongs in the feature that
consumes it. Where a variant would otherwise become a style prop, give it a closed
set of named variants instead, as `Card` and `StatTile` do.
