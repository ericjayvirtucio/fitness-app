# ADR 0031: Deliver the visual identity as a set of token values, and prove its contrast by test

**Status:** Accepted

## Context

The mobile design system has held a complete semantic color contract since
[Specification 0002](../../specs/0002-design-system-foundation.md): twenty-four
roles, two themes, and `getAppTheme` as a pure function of the device appearance.
Nothing outside `design-system/theme` names a color. That boundary was verified
before this change rather than assumed — a search of `apps/mobile/src` and
`apps/mobile/app` for hexadecimal, `rgb`, `rgba`, and `hsl` notation outside
`design-system/theme` returns nothing, and thirteen call sites read `useAppTheme`,
ten of which are design-system components.

A product needs a recognizable appearance, and the values the contract carried
were unremarkable. The question this record settles is what shape the answer
takes, because two shapes were available and only one of them is reversible.

The contract also had a second, quieter problem. Nothing proved that any pair of
roles was legible together. The design-system README stated that automated tests
cannot prove contrast, which is true of a rendered device and not true of two
strings. Three failures were in the shipped palette when this was first measured:
`border` reached 1.74:1 on light `surface` and 2.27:1 on dark `surfaceVariant`,
both below the 3:1 a boundary needs, and `SelectionField` labelled a selected
option in `textPrimary` on a `secondary` fill at 1.53:1 — a selected filter,
period, or unit that a person in dark appearance could not read. None of them was
found by review, because a person cannot see a ratio.

## Decision

**The identity is a set of values in `colors.ts`, not a theme abstraction.**

No new theme object, no theme provider, no named brand layer, and no stored
override. `getAppTheme` stays a pure function of `ColorSchemeName`, so theme
selection remains one expression with no persistence, no migration, and no restore
implication. A user-selectable theme therefore stays additive: it becomes a stored
preference feeding that one call site, whenever it is wanted.

The consequence that makes this worth recording is that the identity reached every
screen without a screen being edited for it. That is a property of the token
boundary rather than of this change, and it is why the identity was scheduled
first in the direction rather than later.

**Contrast is asserted pair by pair, in `theme.spec.ts`, using `contrastRatio`.**

A pair is asserted because a component renders it, not because two roles sound
related. Foreground roles are held to 4.5:1 on each of the three page backgrounds
and each on-color to 4.5:1 on its fill; `border` and `focus` are held to the 3:1
of WCAG 1.4.11; `textDisabled` is held to 3:1 although WCAG exempts disabled
controls entirely.

Two exemptions are stated in the test rather than skipped silently. `surface` and
`surfaceVariant` are backgrounds behind text rather than foregrounds, so their
separation from `background` — 1.21:1 for a filled card on black — is governed by
the card-variant rule instead of by a ratio. `divider` and `skeleton` carry
nothing a person reads, and `Divider` declares `accessibilityRole="none"` to say
so.

**A card's variant states what its edge is for.**

Because a filled card separates from a black page by 1.21:1, and because
`elevated` draws its shadow in `overlay` — a black shadow on a black page — the
variant can no longer be a matter of taste. `outlined` is required wherever the
edge carries meaning: a pressable card, a card holding a control or a destructive
action, or a card beside a sibling of the same kind whose contents would be
ambiguous without a boundary. `filled` is for a card whose edge carries nothing.
`elevated` is emphasis in light appearance and never a boundary.

## Consequences

Every screen changed appearance and no screen changed what it states. The palette
commit touched one file and the full mobile suite passed unmodified, which is
evidence that no test had been asserting a color value.

The assertions could not ship ahead of the values, because the previous palette
fails ten of them. That ordering is a fact about this change rather than a general
rule: from here, a proposed value that fails is caught before it is committed.

Three pre-existing accessibility defects were fixed as a side effect rather than
as a separate change, because a palette is replaced atomically and a partial
palette is not a state worth committing. They are named above.

One limitation is accepted and recorded rather than hidden. No single `focus`
value clears 3:1 against both the page and every fill a ring can be drawn on: in
dark appearance `#8FC5FF` against `primary #22DD55` is 1.00:1. `AppButton` draws
its ring at the component's outer edge, whose adjacent color is the page, and that
pair clears. The inner edge does not. The remedy is a two-tone indicator, which
belongs to a change that owns the component rather than to one that owns the
palette.

The identity color clears the body-text threshold in both themes, so the rule that
it is not used for body copy now rests on meaning rather than on arithmetic. That
is a weaker guarantee than a failing ratio would have been, and it is the honest
one: a color that marks active state stops marking it once ordinary sentences are
printed in it.

## Alternatives considered

**A third named theme with a picker.** Rejected for now, not in principle. It
converts theme selection from a pure function into stored state, which brings a
settings surface, a migration, and a restore path to a change whose purpose is
visual. Keeping `getAppTheme` as the single selection point leaves it additive.

**A dark-only brand theme.** The truest reading of the direction, and it removes
an accessibility option the application already ships in exchange for not
maintaining a second palette. Rejected.

**Inspecting contrast rather than asserting it.** This is what the repository did
until now, and it shipped three failures that survived review. Rejected by its own
evidence.

**A near-black background, or a lighter `surfaceVariant`, to strengthen card
separation.** Raising `surfaceVariant` to `#1F1F1F` takes separation from 1.21:1
to 1.27:1 and drops `border` against it to 2.87:1, below the threshold the
mitigation depends on. The trade buys six hundredths of a ratio and costs the
boundary that makes the trade acceptable. Rejected.

**A brighter light `primary` of `#0F9D3A`.** It reaches 3.56:1 on white, which
fails the 4.5:1 that `AppButton`'s own 16px label needs and that the three
existing identity-colored text call sites need. Rejected on arithmetic; `#0A7A2C`
reaches 5.48:1.
