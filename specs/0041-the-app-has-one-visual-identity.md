# Specification 0041: The app has one visual identity

> Testing-policy note: automated simulator, sprint-suite, and regression-suite
> requirements in this historical specification were superseded by
> [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
> Use command-line Jest/Vitest checks plus risk-based manual device testing.

- Status: Approved
- Date: 2026-08-23
- Amended: 2026-08-23, after auditing the proposal against the merged repository.

## Objective and scope

Give the application a deliberate visual identity and prove its contrast by test,
so that a person opening it recognizes one product rather than a set of correctly
built screens.

The design system currently describes its own intent as a "calm, professional
visual language" and delivers it through a complete semantic token contract. The
tokens are sound; the values are unremarkable. Every screen that presents a
derived number assembles it from `AppText` and `Card`, and two feature slices have
independently written the same labeled-value row.

Version 1 replaces the values of both color themes, adds a contrast function and
the assertions it makes possible, adds one typography step and the text behavior
that step requires, promotes the duplicated labeled-value row into the design
system, and applies the card-variant rule the new background makes necessary. It
adds no production dependency.

`@fitness/domain`, `apps/api`, every migration, user version 11, every index,
every SQL statement, every reader contract, every use case, every repository,
every composition root, the export format, the restore path, and every stored
value are untouched. No numeric value changes, no rule changes, and no data is
read or written differently.

Authentication, synchronization, a user-facing theme picker, an additional icon
set, a chart library, animation work beyond the existing motion tokens, exercise
data import, nutrition data sources, localization, notifications, and AI remain
excluded. Navigation structure is unchanged: the five tabs in
`tab-destinations.ts` keep their routes, order, titles, and automation
identifiers.

## Users and the problem

A person using the application reads numbers from it. A daily energy total, a
week of completed workouts, a body-weight trend, a hydration total against a
target. Those numbers currently render at `typography.display` (40px) at the
largest, inside cards that look like every other card, in a palette where the
primary color is a muted teal that carries no particular meaning.

Nothing is wrong. Nothing is memorable either, and more concretely: a person
scanning a screen cannot tell at a glance which number is the screen's subject,
because the system has no way to say so. A stat that matters and a label that
supports it are the same weight.

## Terminology

- **Identity color** — the single saturated accent that marks active state,
  progress, and success. One color, used consistently, is what makes the
  application recognizable.
- **Hero numeral** — a derived number presented as the primary content of a
  region rather than as a field within it.
- **Identity trade** — a place where the visual direction and an existing
  repository rule disagree, resolved explicitly in this document rather than at
  implementation time.

## Requirements

### Palette

`SemanticColors` keeps all twenty-four roles and all consumers. Only values
change, in `apps/mobile/src/design-system/theme/colors.ts`.

Eight of the twenty-four roles have no consumer in the application today —
`accent`, `information`, `onInformation`, `onSuccess`, `onWarning`, `skeleton`,
`success`, and `warning`. They are given values that clear their thresholds
anyway, because the contract says both themes define every role and a role
without a value is a defect waiting for its first consumer.

Dark, which carries the identity:

| Role             | Value                 | Role            | Value     |
| ---------------- | --------------------- | --------------- | --------- |
| `background`     | `#000000`             | `primary`       | `#22DD55` |
| `surface`        | `#101010`             | `onPrimary`     | `#062B12` |
| `surfaceVariant` | `#1A1A1A`             | `success`       | `#22DD55` |
| `divider`        | `#2E2E2E`             | `onSuccess`     | `#062B12` |
| `border`         | `#666666`             | `secondary`     | `#0F2E1A` |
| `skeleton`       | `#242424`             | `onSecondary`   | `#7BF7A2` |
| `overlay`        | `rgba(0, 0, 0, 0.72)` | `danger`        | `#FF5A4E` |
| `textPrimary`    | `#FFFFFF`             | `onDanger`      | `#3B0703` |
| `textSecondary`  | `#9A9A9A`             | `accent`        | `#FFC14D` |
| `textDisabled`   | `#787878`             | `warning`       | `#FFC14D` |
| `focus`          | `#8FC5FF`             | `onWarning`     | `#2B1A00` |
| `information`    | `#7FB4FF`             | `onInformation` | `#001B3D` |

Light keeps the same identity at the contrast a light background demands:

| Role             | Value                   | Role            | Value     |
| ---------------- | ----------------------- | --------------- | --------- |
| `background`     | `#F7F8F7`               | `primary`       | `#0A7A2C` |
| `surface`        | `#FFFFFF`               | `onPrimary`     | `#FFFFFF` |
| `surfaceVariant` | `#EFF1EF`               | `success`       | `#0A7A2C` |
| `divider`        | `#D5DAD6`               | `onSuccess`     | `#FFFFFF` |
| `border`         | `#7E8781`               | `secondary`     | `#DDF3E2` |
| `skeleton`       | `#E2E6E3`               | `onSecondary`   | `#08301A` |
| `overlay`        | `rgba(7, 18, 14, 0.56)` | `danger`        | `#B3261E` |
| `textPrimary`    | `#0B0F0C`               | `onDanger`      | `#FFFFFF` |
| `textSecondary`  | `#5A625C`               | `accent`        | `#8A5200` |
| `textDisabled`   | `#6B736D`               | `warning`       | `#8A5200` |
| `focus`          | `#0B57D0`               | `onWarning`     | `#FFFFFF` |
| `information`    | `#0B57D0`               | `onInformation` | `#FFFFFF` |

**The identity color is a color for controls, indicators, and hero numerals,
rather than for body copy.** This is a design rule and not a consequence of the
contrast arithmetic. An earlier draft of this specification proposed a light
`primary` of `#0F9D3A` and justified the rule by that value reaching only
3.56:1 on white — below the 4.5:1 body-text threshold. That value was rejected
during review, because the same shortfall applied to `AppButton`'s own label,
which is 16px at weight 600 and therefore not large text, and to the three
existing `AppText color="accent"` call sites in `GoalConfigurationForm`,
`PersonalProfileForm`, and `+not-found`. The deeper `#0A7A2C` reaches 5.48:1 and
clears every threshold, so the rule now rests on meaning rather than on
arithmetic: a color that marks active state stops marking anything once ordinary
sentences are printed in it.

### Contrast is asserted rather than inspected

`design-system/README.md` currently states that automated component tests cannot
prove contrast. That remains true of rendered contrast on a device. It is not
true of the token pairs themselves, and a palette this saturated should not rely
on inspection.

Version 1 adds a `contrastRatio` function to the design system, unit-tested
against known WCAG pairs, and extends `theme.spec.ts` to assert that every
foreground-on-background pair in both themes clears its threshold: 4.5:1 for body
text and on-color pairs, 3:1 for user-interface components and graphical objects.
`textDisabled` is held to 3:1 although WCAG exempts disabled controls entirely.

Two exemptions are stated rather than asserted, because inventing a floor for
them would force the identity out:

- **Surface separation.** `surface` and `surfaceVariant` are backgrounds behind
  text, not foregrounds. Their separation from `background` is a tonal hint —
  1.10:1 and 1.21:1 in dark — and the elevation trade below is how that is
  handled.
- **Decoration.** `divider` and `skeleton` carry no information a person must
  read. `Divider` declares `accessibilityRole="none"` for exactly this reason.

One limitation is stated rather than hidden. No single `focus` value clears 3:1
against both the page and every fill a focus ring can be drawn on: in dark,
`#8FC5FF` against `primary #22DD55` is 1.00:1. `AppButton` draws its ring at the
component's outer edge, whose adjacent color is the page, and that pair clears.
The inner edge does not. The remedy is a two-tone ring, which is component work
this change does not include. `focus` is therefore asserted against the three page
backgrounds, and the gap is recorded in the design-system README.

The current palette fails these assertions in three places, which is why the
assertions ship in the same change as the values rather than ahead of them:
light `border` reaches 1.74:1 on `surface`, dark `border` reaches 2.27:1 on
`surfaceVariant`, and dark `textPrimary` on `secondary` — which is what
`SelectionField` renders for a selected option — reaches 1.53:1.

### The elevation trade

On a pure black background, `Card`'s `filled` variant separates from the page by
1.21:1. That is the identity working as intended — separation by surface
lightness rather than by border or shadow — and it is also the weakest part of
the direction in bright ambient light.

A near-black background was priced against it and rejected. Raising
`surfaceVariant` to `#1F1F1F` improves separation to 1.27:1 and drops `border` to
2.87:1 against it, which fails the 3:1 the mitigation below depends on. The trade
buys six hundredths of a ratio and costs the boundary that makes the trade
acceptable.

`Card`'s `elevated` variant is `filled` plus `elevations.raised`, whose
`shadowColor` is `overlay`. On a black page a black shadow renders nothing, so
`elevated` separates no better than `filled` in dark.

**The variant rule, which screens follow rather than choosing by preference:**

- Use **`outlined`** when the card's edge carries meaning: the card is pressable;
  the card holds a control or a destructive action; or the card sits directly
  beside a sibling of the same kind and its contents would be ambiguous without a
  boundary.
- Use **`filled`** only for a card whose edge carries nothing — a single
  non-interactive block of content on the page.
- **`elevated` never counts as a boundary.** It is emphasis in light appearance
  and a plain filled card in dark.

Applying the rule converts the four `filled` cards in the repository to
`outlined`, because each of them holds an `AppButton`.

### Tokens

One addition: `typography.hero`, 56px, weight 800, tight tracking, for hero
numerals. `AGENTS.md` and the design-system README require a repeated, reviewed
need rather than a one-off preference. An earlier draft claimed four consumers —
Today's primary metric, Progress stat values, the Nutrition energy total, and the
body-weight current value. Two of those do not exist: Progress renders every
value at `typography.label` and designates no primary, and the body-measurement
screen is a list of check-in cards with no current-value display. The demonstrated
need is two: Today's total fluid, which renders at `display` today, and the
Nutrition diary's energy total, which renders at `heading`. A third exists off-tab
on the personal-record card and is deliberately left alone in this change.

`theme.spec.ts` gains the ordering assertion that `hero` exceeds `display`.

`hero` also requires a text behavior the design system does not have.
`AppText` sets `maxFontSizeMultiplier={2}`, so a hero numeral reaches 112px at the
largest accessibility size and wraps, because React Native does not shrink text to
fit by default. `AppText` therefore gains an opt-in that shrinks a single line
rather than wrapping or truncating it, and the hero call sites use it. Without
that, acceptance criterion 7 below cannot be met.

No other token changes. `radii.extraLarge` (24) already matches the intended card
radius, and the spacing, opacity, border-width, icon-size, and motion scales are
untouched.

### Components

Placement follows the design system's own admission rule — a component enters the
design system when reuse is demonstrated, not anticipated. An earlier draft
proposed nine components. Audited against the screens rather than against a table,
one of them qualifies.

`StatTile` — one labeled derived value. `ProgressScreen` and `GoalsEnergyScreen`
have each independently written a `Metric` component with the identical accessible
name contract, `` `${label}, ${value}` ``, and different layouts: Progress renders
a dense row, Goals & Energy a stacked pair. `StatTile` carries both as closed
variants, `row` and `stacked`, in the way `Card` carries three, and exports
`describeStatTile` alongside `describeCardContents` so the composed card names
that already depend on that sentence keep one source. Both call sites render and
announce exactly what they render and announce today.

The other eight are deferred, with the evidence:

- **`Chip`** — no chip-like usage exists anywhere in the application, and
  `ExerciseFilterControls` records that chips were considered and rejected for the
  exercise library on the grounds that twenty-five of them are nearly two screens
  at the largest accessible size.
- **`SegmentedControl`** — both claimed consumers already exist as
  `SelectionField`, carrying `radiogroup` and `radio` roles, the `progress-period`
  and `workout-history-period` identifiers, and the period contract of
  [ADR 0026](../docs/decisions/0026-a-period-control-governs-every-list-beneath-it.md).
  A new component replaces a working, tested control and adds no consumer.
- **`Stepper`** — every numeric input in the application is a validated free-text
  `TextField`. Bounded increments are an input-semantics change rather than a
  visual one, and decimal masses are not steppable.
- **`ActionFab`** — Today, Nutrition, and Workout each already present a primary
  action as a full-width `AppButton` that end-to-end flows tap by name. A docked
  control would duplicate or replace them, and the Nutrition diary does not pass
  `hasTabBar`, so a docked control there would sit under the tab bar.
- **`TrendChart`** — the data does not exist. `BodyWeightProgressSummary` carries
  a first and a latest value by design, not a series, and `ProgressSummary.days`
  covers only the selected day, week, or month. Drawing a body-weight trend
  requires a new reader and a new query, which this specification's own
  performance requirement forbids.
- **`WeekStrip`** — Today is the hydration screen and loads no week and no workout
  data. The planner's week is seven labeled pressable cards carrying
  `weekday-card-{0..6}`. One consumer, and adopting it there is a rewrite of a
  tested surface. This closes the question of whether the component shows planned
  or completed workouts by removing the component.
- **`ActivityHeatmap`** — `ProgressSummary.days` reaches thirty-one days, not the
  three hundred and seventy-one a year of cells needs, and `DailyActivity` already
  states each day's nutrition, hydration, and workout counts in a labeled card. A
  grid replacing it would remove stated values, which
  [ADR 0030](../docs/decisions/0030-a-value-is-stated-by-every-screen-that-computes-it.md)
  forbids.
- **`StickyTimer`** — no rest-timer state exists in the repository. Rest timing
  within a session is phase 4 of the direction in `PRODUCT.md`, not phase 1.

Each is admitted when its consumers or its data exist, and not before.

### Screens

No screen changes what it states. The changes are:

- Every screen is repainted, because every color reaches it through the theme.
- The four `filled` cards become `outlined` under the variant rule.
- `ProgressScreen` and `GoalsEnergyScreen` render their values through `StatTile`
  instead of a local `Metric`, with identical output.
- The hydration daily screen states its total fluid at `hero` rather than
  `display`.
- The nutrition diary states its energy total at `hero` rather than `heading`.

[ADR 0028](../docs/decisions/0028-a-summary-states-every-value-it-computes.md),
[ADR 0029](../docs/decisions/0029-a-captured-value-is-a-value-a-summary-can-state.md),
and [ADR 0030](../docs/decisions/0030-a-value-is-stated-by-every-screen-that-computes-it.md)
govern which values a screen states, and Specifications
[0038](0038-progress-states-everything-it-counted.md),
[0039](0039-progress-counts-every-nutrient-you-logged.md), and
[0040](0040-the-workouts-card-states-what-it-recorded.md) applied them. This
specification governs how those values look and must not remove one.

## Behavior

**Offline** — unchanged. Nothing added here reads the network.

**Data and migration** — none. User version stays 11, the export format stays at
its current version, and an export written before this change restores after it.

**Failure and recovery** — unchanged. No new sentence is written. Every empty,
partial, and error state renders the words it renders today, restyled.

**Accessibility** — the contrast assertions above are the floor, not the ceiling.
Color is never the only carrier of state: `SelectionField` keeps
`accessibilityState.checked` and `AppButton` keeps `busy` and `disabled`. Stop
counts are unchanged on every screen, because nothing interactive is added or
removed and `StatTile` inherits the accessible name of the `Metric` it replaces.
Hero numerals shrink rather than truncate at the largest accessibility sizes.

**Privacy and security** — no new data is collected, stored, transmitted, or
logged.

**Performance** — no query, no index, and no second read is introduced.
`contrastRatio` runs in tests and never at render.

## Architecture boundaries and affected files

- `apps/mobile/src/design-system/theme/colors.ts` — values only.
- `apps/mobile/src/design-system/theme/tokens.ts` — `typography.hero`.
- `apps/mobile/src/design-system/theme/contrast.ts` and its spec — new.
- `apps/mobile/src/design-system/theme/theme.spec.ts` — contrast assertions.
- `apps/mobile/src/design-system/components/StatTile.tsx` and its spec — new.
- `apps/mobile/src/design-system/components/AppText.tsx` — single-line shrinking.
- `apps/mobile/src/design-system/index.ts` — the public surface.
- `apps/mobile/src/design-system/README.md` — the stated visual intent, the
  component list, the variant rule, and the narrowed contrast claim.
- The card call sites the variant rule converts, and the two hero call sites.

Verified against the merged repository before amending this specification: no
hexadecimal color literal exists anywhere in `apps/mobile/src` or
`apps/mobile/app` outside `design-system/theme`, and thirteen call sites read
`useAppTheme` — ten design-system components, two application layouts, and one
feature component. **The palette change is one file and requires no screen edit.**
That fact is what makes this the first phase rather than a later one. An earlier
draft of this specification, and the direction section of `PRODUCT.md`, put the
figure at sixteen files across the feature code; the correct figure makes the
argument stronger rather than weaker, because features read color through
components rather than directly.

## Dependency

None. An earlier draft introduced `react-native-svg` for two visualizations. Both
are deferred above for want of the data they would draw, so the dependency has no
consumer, and `AGENTS.md` requires a concrete use case. It arrives with the change
that needs it.

## Acceptance criteria

1. Both themes define all twenty-four roles, and `theme.spec.ts` proves every
   asserted pair clears its threshold in both.
2. `contrastRatio` returns known values for known pairs, including 21:1 for black
   on white and 1:1 for a color on itself.
3. No hexadecimal color literal exists outside `design-system/theme`.
4. `StatTile` has a behavior-focused spec covering role, name, and both variants,
   and appears in the design-system README.
5. `tab-destinations.ts` is unchanged and every automation identifier survives.
6. Every value each screen stated before this change is stated after it.
7. Hero numerals remain fully visible at the largest Dynamic Type setting.
8. `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass with no new
   warnings.
9. Manual QA sprint 41 passes on iOS and Android.

## Alternatives considered

- **A third named theme with a picker in Profile.** Rejected for version 1, not
  rejected in principle. It converts theme selection from a pure function of
  device appearance into stored state, which brings a migration, settings
  surface, and restore-path implications for a change whose purpose is visual.
  Keeping `getAppTheme` as the single selection point leaves it additive later.
- **A dark-only brand theme, dropping the light theme.** Rejected. It is the
  truest reading of the direction and it removes an accessibility option the
  application already ships, in exchange for not maintaining a second palette.
- **A center action button in the tab bar.** Rejected on structure: it would have
  to mean "start a workout" in an application whose nutrition capabilities are
  equally central, and it would occupy the slot the Workout tab already holds.
- **A light `primary` of `#0F9D3A`, keeping the brighter green.** Rejected on
  arithmetic, above.
- **A near-black background, or a lighter `surfaceVariant`.** Rejected on
  arithmetic, above.
- **Shipping the seven proposed design-system components.** Rejected by the
  design system's own admission rule, component by component, above.
- **Adopting `react-native-svg` anyway, ahead of its consumers.** Rejected under
  the dependency rule. It is a native module in a bare workflow with committed
  pods, so it costs a pod install and a rebuild on both platforms against no
  present consumer.

## Testing

Unit tests for `contrastRatio` and the extended token contract. Behavior tests for
`StatTile` and for `AppText`'s shrinking behavior, following the existing
component specs. Existing screen tests are expected to pass unchanged; a screen
test that fails is evidence that a stated value was lost or that a test asserted a
color value, not evidence the test needs updating.

Maestro sprint 41 asserts that each of the five tabs still states its values after
the repaint. It introduces no new selector, because this change introduces no
control and no string.

## Documentation

`design-system/README.md` in the same change as the behavior it describes: the
stated visual intent, the component list, the card-variant rule, the extension
rule as applied here, the narrowed contrast claim, and the focus-ring limitation.
`docs/architecture/` gains a design-system entry describing the token boundary,
the placement rule, and the contrast contract. One ADR records the identity as a
token-value change rather than a theme abstraction.
`docs/manual-testing/sprint-41-*.md` accompanies the QA suite.

## Rollout and rollback

No migration, no stored state, no feature flag. The change is reversible by
reverting its commits; a person's data is untouched either way. There is no
partial state a rollback could strand.

## Unresolved questions

1. `Workout time` remains ambiguous on Progress, as
   [Specification 0040](0040-the-workouts-card-states-what-it-recorded.md)
   recorded. This change does not rename it.
2. The focus ring's inner edge, recorded above, is a real gap awaiting a two-tone
   indicator.

The question of whether the light theme keeps the identity accent is resolved
above: it keeps it, at a deeper value that permits identity-colored text without
requiring it. The question of whether `WeekStrip` shows planned or completed
workouts is resolved by deferring the component.

## Approval

Approved by the repository owner after the Stage 1 audit that produced the
amendments above.
