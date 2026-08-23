# Mobile design system

The design system owns how the application looks and how its building blocks
behave. It owns no product rule, no capability, and no copy.

Related: [ADR 0031](../decisions/0031-the-visual-identity-is-a-set-of-token-values.md),
[ADR 0024](../decisions/0024-labelled-containers-announce-their-contents.md),
[Specification 0002](../../specs/0002-design-system-foundation.md),
[Specification 0041](../../specs/0041-the-app-has-one-visual-identity.md), and the
[usage guide](../../apps/mobile/src/design-system/README.md).

## The token boundary

`apps/mobile/src/design-system/index.ts` is the only entry point. Features and
routes import components and tokens from it; nothing outside
`design-system/theme` names a color, a size, or a duration.

That boundary is load-bearing rather than tidy. Because no feature file holds a
color literal, replacing both palettes is one file and reaches every screen
without a screen being edited. Verify it rather than trusting it:

```bash
grep -rInE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" apps/mobile/src apps/mobile/app \
  --include="*.ts" --include="*.tsx" | grep -v "design-system/theme/"
```

A match is a defect in the change that introduced it, because it is a value the
themes cannot reach.

## Appearance selection

`getAppTheme(colorScheme)` is a pure function of the device appearance and the
single point at which a theme is chosen. `useAppTheme()` is the hook over it, and
the root layout maps the same semantic theme into React Navigation.

There is no stored override and no second provider. Keeping selection pure is what
leaves a user-selectable theme additive: it would become a stored preference
feeding this one call site, with no migration and no restore-path implication.

## The contrast contract

`theme/contrast.ts` computes the WCAG contrast ratio between two hexadecimal
colors. It throws on anything it cannot measure — a translucent `overlay` has no
ratio until it is composited — because a silent fallback would turn a mistyped
token into a passing assertion.

`theme/theme.spec.ts` asserts every pair a component renders, pair by pair rather
than in aggregate:

| Pair                                                         | Threshold |
| ------------------------------------------------------------ | --------- |
| a foreground role on `background`/`surface`/`surfaceVariant` | 4.5:1     |
| an `on*` role on the fill it names                           | 4.5:1     |
| `textPrimary` on `secondary`, which `SelectionField` renders | 4.5:1     |
| `border` and `focus` on each page background                 | 3:1       |
| `textDisabled` on each page background                       | 3:1       |

`textDisabled` is held to 3:1 although WCAG exempts disabled controls entirely.

Two exemptions are stated in the test rather than skipped. `surface` and
`surfaceVariant` are backgrounds behind text, so their separation from
`background` is governed by the card-variant rule below rather than by a ratio.
`divider` and `skeleton` carry nothing a person reads.

One limitation is recorded rather than hidden: no single `focus` value clears 3:1
against both the page and every fill a ring can be drawn on. Rings are drawn at a
component's outer edge, whose adjacent color is the page, and that is the pair
asserted.

Adding a role, or a component that renders a new pair, means adding its assertion
in the same change.

## The card-variant rule

The dark background is true black, so a filled card separates from it by 1.21:1
and `elevated` draws a black shadow that renders nothing. A card's variant states
what its edge is for: `outlined` where the edge carries meaning, `filled` where it
carries nothing, `elevated` for emphasis in light appearance and never as a
boundary. The [usage guide](../../apps/mobile/src/design-system/README.md) states
the three clauses a screen applies.

## What may enter

A component enters the design system when reuse is demonstrated, not anticipated.
The rule is applied against the screens rather than against a proposal.

`StatTile` entered because `ProgressScreen` and `GoalsEnergyScreen` had each
independently written a labeled-value component with the identical accessible-name
contract and a different layout, which the two closed variants carry.

Eight further components were proposed alongside it and did not enter: three had
no consumer, two had no data to draw from an already-loaded summary, one had a
single consumer whose surface it would have rewritten, one changed input semantics
rather than appearance, and one was a capability from a later phase. Each is
admitted when its consumers or its data exist. The reasoning is recorded in
[Specification 0041](../../specs/0041-the-app-has-one-visual-identity.md) so that
a later author re-proposing one starts from the evidence rather than from scratch.

A component with one consumer belongs in the feature slice that consumes it, as
`ExerciseFilterControls` does.

## Accessibility ownership

The design system owns roles, names, states, focus behavior, touch targets, and
Dynamic Type. It does not own what a screen states — that is
[ADR 0028](../decisions/0028-a-summary-states-every-value-it-computes.md) and
[ADR 0030](../decisions/0030-a-value-is-stated-by-every-screen-that-computes-it.md).

Two consequences travel together and are easy to get wrong separately. A container
carrying an `accessibilityLabel` is one accessibility element, so its children are
unreachable: `describeCardContents` and `describeStatTile` exist so that a card's
announced name is composed from the same list it renders. And a container carrying
an `accessibilityLabel` must not contain a control, because the control becomes
unreachable — a defect this repository has shipped once and now checks for.
