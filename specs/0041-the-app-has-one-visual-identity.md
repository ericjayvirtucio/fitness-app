# Specification 0041: The app has one visual identity

- Status: Proposed
- Date: 2026-08-23

## Objective and scope

Give the application a deliberate visual identity and the display components its
existing screens already need, so that a person opening it recognizes one product
rather than a set of correctly built screens.

The design system currently describes its own intent as a "calm, professional
visual language" and delivers it through a complete semantic token contract. The
tokens are sound; the values are unremarkable, and the components stop at forms
and containers. Every screen that presents a derived number — Progress, Today,
Nutrition, Workout History — assembles it from `AppText` and `Card` because
nothing more specific exists.

Version 1 replaces the values of both color themes, adds one typography step,
adds five presentation primitives and two data visualizations to the design
system, adds two visualizations to the feature slices that own them, and applies
them to the five tabs. It adds one production dependency.

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
scanning Progress cannot tell at a glance which numbers matter, because the
system has no way to say so. A stat that matters and a label that supports it are
the same weight.

## Terminology

- **Identity color** — the single saturated accent that marks active state,
  progress, and success. One color, used consistently, is what makes the
  application recognizable.
- **Hero numeral** — a derived number presented as the primary content of a
  region rather than as a field within it.
- **Presentation primitive** — a design-system component that displays state and
  accepts interaction, without knowing which capability supplies it.
- **Identity trade** — a place where the visual direction and an existing
  repository rule disagree, resolved explicitly in this document rather than at
  implementation time.

## Requirements

### Palette

`SemanticColors` keeps all twenty-four roles and all consumers. Only values
change, in `apps/mobile/src/design-system/theme/colors.ts`.

Dark, which carries the identity:

| Role                     | Value                 |
| ------------------------ | --------------------- |
| `background`             | `#000000`             |
| `surface`                | `#101010`             |
| `surfaceVariant`         | `#1A1A1A`             |
| `divider`                | `#262626`             |
| `border`                 | `#333333`             |
| `primary`, `success`     | `#22DD55`             |
| `onPrimary`, `onSuccess` | `#062B12`             |
| `secondary`              | `#0F2E1A`             |
| `onSecondary`            | `#7BF7A2`             |
| `accent`                 | `#FFC14D`             |
| `danger`                 | `#FF5A4E`             |
| `textPrimary`            | `#FFFFFF`             |
| `textSecondary`          | `#9A9A9A`             |
| `textDisabled`           | `#5C5C5C`             |
| `overlay`                | `rgba(0, 0, 0, 0.72)` |

Light keeps the same identity at the contrast the background demands:
`background #F7F8F7`, `surface #FFFFFF`, `surfaceVariant #EFF1EF`,
`primary #0F9D3A`, `accent #B26A00`, `textPrimary #0B0F0C`,
`textSecondary #5A625C`. Remaining roles follow from these and are stated in the
implementation rather than enumerated twice.

**One rule follows from the contrast arithmetic and is part of this
specification: the identity color is a color for controls, indicators, and hero
numerals, never for body copy.** `#22DD55` on black clears every threshold, but
its light-theme counterpart `#0F9D3A` on white reaches roughly 3.6:1 — sufficient
for user-interface components and large text, insufficient for 15px body text.
A rule that holds in one theme and not the other is a defect waiting for a
screen, so it is stated as a single rule that holds in both.

### Contrast is asserted rather than inspected

`design-system/README.md` currently states that automated component tests cannot
prove contrast. That remains true of rendered contrast on a device. It is not
true of the token pairs themselves, and a palette this saturated should not rely
on inspection.

Version 1 adds a `contrastRatio` function to the design system, unit-tested
against known WCAG pairs, and extends `theme.spec.ts` to assert that every
foreground-on-background pair in both themes clears its threshold: 4.5:1 for body
text, 3:1 for large text, user-interface components, and graphical objects.
`textDisabled` is held to 3:1 although WCAG exempts disabled controls entirely.

### The elevation trade

On a pure black background, `Card`'s `filled` variant separates from the page by
roughly 1.2:1. That is the identity working as intended — separation by surface
lightness rather than by border or shadow — and it is also the weakest part of
the direction in bright ambient light.

This is accepted rather than hidden. The mitigation is that `Card`'s `outlined`
variant, which draws `border`, remains the correct choice wherever a boundary
carries meaning rather than decoration: a card a person must act on, a card
holding a destructive action, and any card whose contents would be ambiguous if
its edge were invisible. Screens are not free to pick a variant by preference.

### Tokens

One addition: `typography.hero`, 56px, weight 800, tight tracking, for hero
numerals. `AGENTS.md` and the design-system README require a repeated,
reviewed need rather than a one-off preference; the need is four consumers —
Today's primary metric, Progress stat values, the Nutrition energy total, and the
body-weight current value. `theme.spec.ts` gains the ordering assertion that
`hero` exceeds `display`.

No other token changes. `radii.extraLarge` (24) already matches the intended card
radius, and the spacing, opacity, border-width, icon-size, and motion scales are
untouched.

### Components

Placement follows the design system's own admission rule — a component enters the
design system when reuse is demonstrated, not anticipated.

Design system, exported from `index.ts`:

| Component          | Purpose                                           | Consumers demonstrating reuse                        |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------- |
| `Chip`             | Compact labeled attribute                         | Exercise library, workout session, nutrition catalog |
| `SegmentedControl` | Mutually exclusive period or range                | Progress, workout history                            |
| `Stepper`          | Increment and decrement a bounded value           | Workout set logging, nutrition quantity              |
| `StatTile`         | One labeled derived value, optionally with change | Progress, Today, Nutrition                           |
| `ActionFab`        | A screen's single primary action                  | Today, Workout, Nutrition                            |
| `TrendChart`       | A value over time with an optional target line    | Progress body weight, Progress energy                |
| `WeekStrip`        | Seven days with per-day activity and selection    | Today, workout planner                               |

Feature slices, because each has exactly one consumer today:

- `ActivityHeatmap` in `features/progress-analytics` — a calendar grid of
  training density.
- `StickyTimer` in `features/workout-session` — a rest countdown docked below
  session content.

Either is promoted into the design system when a second consumer appears, and not
before.

`Stepper` carries the `adjustable` accessibility role with increment and
decrement actions. `ActionFab` publishes a `testID` because end-to-end flows
drive it. Icons come from `AppIcon` only; no second icon set is introduced.

### The primary action is per-screen

The visual direction this work draws on places a single raised action button at
the center of the tab bar. That works where training is the only pillar. Here it
would have to mean "start a workout" while sitting in the tab bar of an
application whose nutrition capabilities are equally central, and it would
occupy the slot the Workout tab already holds.

`ActionFab` is therefore a screen-level control: Today and Workout present
"Start workout", Nutrition presents "Log food". The tab bar is restyled and
otherwise unchanged.

### Screens

Today gains `WeekStrip`, a hero metric, and `ActionFab`. Progress gains a
`StatTile` grid, `SegmentedControl` over its existing Today, This Week, and This
Month periods, `TrendChart`, and `ActivityHeatmap`. Nutrition gains `StatTile`
and `ActionFab`. Workout gains `ActionFab` and `Chip`. Profile is recolored only.

No screen changes what it states.
[ADR 0028](../docs/decisions/0028-a-summary-states-every-value-it-computes.md),
[ADR 0029](../docs/decisions/0029-a-captured-value-is-a-value-a-summary-can-state.md),
and [ADR 0030](../docs/decisions/0030-a-value-is-stated-by-every-screen-that-computes-it.md)
govern which values a screen states, and Specifications
[0038](0038-progress-states-everything-it-counted.md),
[0039](0039-progress-counts-every-nutrient-you-logged.md), and
[0040](0040-the-workouts-card-states-what-it-recorded.md) applied them. This
specification governs how those values look and must not remove one.

## Behavior

**Offline** — unchanged. Nothing added here reads the network. `TrendChart`,
`ActivityHeatmap`, and `WeekStrip` render from data their screens already load.

**Data and migration** — none. User version stays 11, the export format stays at
its current version, and an export written before this change restores after it.

**Failure and recovery** — the visualizations render from summaries that may be
empty. Each states its own empty case through `EmptyState` rather than drawing an
empty axis.

**Accessibility** — the contrast assertions above are the floor, not the ceiling.
Color is never the only carrier of state: selection in `SegmentedControl` and
`WeekStrip` also carries `selected` state, `TrendChart`'s target line is labeled
rather than merely colored, and `ActivityHeatmap` exposes a text summary rather
than requiring color discrimination across five intensity levels. Dynamic Type
must not clip hero numerals; every new component is verified at the largest
accessibility sizes, and hero numerals shrink rather than truncate.

**Privacy and security** — no new data is collected, stored, transmitted, or
logged. `react-native-svg` receives no user data beyond the coordinates the
charts compute locally.

**Performance** — `ActivityHeatmap` draws up to 371 cells and `TrendChart` up to
a year of points. Both render from an already-loaded summary and must not
introduce a query, an index, or a second read.

## Architecture boundaries and affected files

- `apps/mobile/src/design-system/theme/colors.ts` — values only.
- `apps/mobile/src/design-system/theme/tokens.ts` — `typography.hero`.
- `apps/mobile/src/design-system/theme/contrast.ts` and its spec — new.
- `apps/mobile/src/design-system/theme/theme.spec.ts` — contrast assertions.
- `apps/mobile/src/design-system/components/` — seven new components and specs.
- `apps/mobile/src/design-system/index.ts` — the public surface.
- `apps/mobile/src/design-system/README.md` — the stated visual intent, the
  component list, and the contrast claim.
- `apps/mobile/src/features/progress-analytics/`, `features/workout-session/` —
  one visualization each.
- `apps/mobile/app/(tabs)/` and the five screens — application.
- `apps/mobile/package.json` and `apps/mobile/ios/` — `react-native-svg`.

Verified before writing this specification: no hexadecimal color literal exists
anywhere in `apps/mobile/src` or `apps/mobile/app` outside
`design-system/theme`, and sixteen files call `useAppTheme` across forty-one
feature components. **The palette change is one file and requires no screen
edit.** That fact is what makes this the first phase rather than a later one.

## Dependency

`react-native-svg`, MIT, maintained by Software Mansion, first-class in the Expo
SDK, already a transitive expectation of the Expo ecosystem, and the standard
drawing surface for React Native. It is a native module, so it requires an iOS
pod install and a rebuild.

It is introduced in its own change, ahead of the components that need it and
behind everything that does not, so that a build failure attributable to native
linking is never mixed with a design review. It requires an ADR in
`docs/decisions` alongside its introduction, matching how
[ADR 0004](../docs/decisions/0004-expo-sqlite-local-persistence.md) records
`expo-sqlite` and
[ADR 0009](../docs/decisions/0009-maestro-mobile-e2e-harness.md) records the
Maestro harness.

## Acceptance criteria

1. Both themes define all twenty-four roles, and `theme.spec.ts` proves every
   pair clears its threshold in both.
2. `contrastRatio` returns known values for known pairs, including 21:1 for black
   on white and 1:1 for a color on itself.
3. No hexadecimal color literal exists outside `design-system/theme`.
4. Every new component has a behavior-focused spec covering role, name, state,
   and interaction, and appears in the design-system README.
5. `ActionFab` appears on Today, Workout, and Nutrition, and nowhere in the tab
   bar. `tab-destinations.ts` is unchanged.
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
- **A center action button in the tab bar.** Rejected on structure, discussed
  above.
- **Ship the palette and defer every component.** Rejected as the change that
  looks complete and is not: the screens that most need the identity are exactly
  the ones assembling numbers by hand today.
- **Adopt a charting library.** Rejected under the dependency rule. Two
  visualizations of known shape do not justify a library where
  `react-native-svg` — which the library would depend on anyway — is sufficient.
- **Keep `StickyTimer` and `ActivityHeatmap` in the design system.** Rejected by
  the design system's own admission rule. Both have one consumer.

## Testing

Unit tests for `contrastRatio` and the extended token contract. Behavior tests
for each component under `@testing-library/react-native`, following the existing
component specs. Existing screen tests are expected to pass unchanged; a screen
test that fails is evidence a stated value was lost, not evidence the test needs
updating.

Maestro sprint 41 covers the flows the new controls introduce: selecting a period
through `SegmentedControl`, adjusting a value through `Stepper`, and starting a
workout through `ActionFab`.

## Documentation

`design-system/README.md` in the same change as the behavior it describes: the
stated visual intent, the component list, the extension rule as applied here, and
the narrowed contrast claim. `docs/architecture/` gains a design-system entry
describing the token boundary and the placement rule. Two ADRs:
one recording the identity as a token-value change rather than a theme
abstraction, one recording `react-native-svg`.
`docs/manual-testing/sprint-41-*.md` accompanies the QA suite.

## Rollout and rollback

No migration, no stored state, no feature flag. The change is reversible by
reverting its commits; a person's data is untouched either way. There is no
partial state a rollback could strand.

## Unresolved questions

1. Does the light theme keep the identity accent, or take a deeper green that
   clears 4.5:1 and permits identity-colored body copy? Version 1 assumes the
   former and forbids identity-colored body copy in both themes.
2. Does `WeekStrip` show planned workouts, completed workouts, or both? Today and
   the planner may want different answers, which would make it two components.
3. `Workout time` remains ambiguous on Progress, as
   [Specification 0040](0040-the-workouts-card-states-what-it-recorded.md)
   recorded.
   This change makes it more prominent without resolving it, and does not rename
   it.

## Approval

Awaiting the repository owner. The direction, the theming approach, and the
per-screen primary action were agreed before this document was written; the
palette values, component placement, and phasing in it have not been reviewed.
