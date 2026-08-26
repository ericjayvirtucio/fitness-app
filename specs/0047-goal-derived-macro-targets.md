# Specification 0047: Goal-derived daily macronutrient targets

> Implementation note: Sprint 49 implemented this specification against the
> calculated-target card's actual location, discovered during implementation to
> differ from "Application" and "Display" below — see the note after "Display"
> for what changed and why the acceptance criteria are still met unmodified.

- Status: Approved
- Date: 2026-08-26
- Amended: 2026-08-26, to record Sprint 49 implementation and reconcile the
  "Application" and "Display" sections with the calculated-target card's
  actual location (see the implementation note after "Display").

## Objective and scope

Let a person with a saved goal see a daily protein, carbohydrate, and fat
target, derived entirely from their existing profile and goal configuration,
alongside the daily calorie target Goals & Energy already computes. No food
is logged against it, no food database is consulted, and nothing new is
persisted.

This is Phase 5's (Nutrition Depth) first approved outcome, and it addresses
only the macro-target half of that phase's two-part exit criterion — "a
person has a macro target derived from their own goal and energy
configuration." The other half — "logging a food item finds it in a real
database most of the time" — is a separate, still-unapproved track. [ADR
0035](../docs/decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md)
records why the two are decoupled and why no food-data provider is approved
yet. This specification does not implement, and this sprint (Sprint 48) does
not implement, any part of it — Sprint 48 produces this specification as the
approved, implementation-ready outcome for Sprint 49.

Version 1 adds one new pure domain module, one derived field on the existing
energy summary, and three additional read-only lines on the existing
Goals & Energy screen. It adds no new package, screen, tab, table, column,
migration, dependency, or export field.

## Terminology

- **Macronutrient distribution** — the fixed percentage of daily calories
  this specification assigns to protein, carbohydrate, and fat: 20%, 50%,
  and 30% respectively. It is one representative point inside the published
  Acceptable Macronutrient Distribution Range (AMDR), not a personalized or
  adjustable value in this version — the same pattern this codebase already
  uses for the five fixed activity-level multipliers in
  `energy-estimates.ts` ("explicit representative product values within the
  Academy's published PAL ranges," per
  [goals-and-energy.md](../docs/architecture/goals-and-energy.md)).
- **Macronutrient target** — the grams of protein, carbohydrate, and fat
  implied by applying the macronutrient distribution to a person's existing
  daily calorie target. It is computed, not recorded, and carries no
  provenance of its own — it is arithmetic over two already-approved
  domain values (the calorie target and the fixed distribution).
- **AMDR** — the Acceptable Macronutrient Distribution Range: the range of
  energy intake, by macronutrient, associated with reduced chronic-disease
  risk while meeting nutrient needs, as described in the National Academies'
  Dietary Reference Intakes work. See "Formula, evidence, and rationale"
  below for the exact ranges and citation.

## Domain

A new module, `packages/domain/src/goals-energy/macro-targets.ts`, exports:

```ts
export const macronutrientDistributionPolicy = Object.freeze({
  carbohydratePercentageOfCalories: 50,
  fatPercentageOfCalories: 30,
  proteinPercentageOfCalories: 20,
});

export const macronutrientCaloriesPerGram = Object.freeze({
  carbohydrate: 4,
  fat: 9,
  protein: 4,
});

export interface MacronutrientTargets {
  readonly carbohydrateGrams: number;
  readonly fatGrams: number;
  readonly proteinGrams: number;
}

export function calculateDailyMacronutrientTargets(
  dailyCalorieTarget: Energy,
): MacronutrientTargets;
```

`calculateDailyMacronutrientTargets` multiplies the target's kilocalories by
each macronutrient's percentage and divides by its calories-per-gram factor.
It takes an already-constructed `Energy`, which
`calculateDailyCalorieTarget` (`goal-configuration.ts`) has already validated
as positive and at least 1,000 kilocalories, so there is no invalid input
this function can receive and no failure mode to report — it returns
`MacronutrientTargets` directly rather than a `Result`, consistent with this
codebase reserving `Result` for computations that can actually fail on their
given input. The three percentages are `Object.freeze`d module constants
summing to exactly 100, so the three returned gram values always account for
the whole calorie target with no remainder and no rounding inside the
domain layer — full floating-point precision is retained, matching every
other calculation in this file
(see "Precision" in
[goals-and-energy.md](../docs/architecture/goals-and-energy.md)).

Both new constants and the new function are exported from `@fitness/domain`
alongside `calculateDailyCalorieTarget`, `estimateMaintenanceEnergy`, and the
package's other goals-energy exports.

No change reaches `GoalConfiguration`, `Energy`, or any nutrition domain
type. The distribution is a fixed policy, not a per-person setting, so
`GoalConfiguration` gains no new field and no new validation branch.

## Formula, evidence, and rationale

The Acceptable Macronutrient Distribution Range for adults is 45–65% of
calories from carbohydrate, 20–35% from fat, and 10–35% from protein,
established by the National Academies' Dietary Reference Intakes work and
restated in the National Academies Press's 2025 letter report ["Rethinking
the Acceptable Macronutrient Distribution Range for the 21st
Century"](https://www.ncbi.nlm.nih.gov/books/NBK610333/) (National Academies
Press, accessed 2026-08-26). This specification's fixed distribution — 20%
protein, 50% carbohydrate, 30% fat — falls inside all three ranges
simultaneously and is not itself derived from any person-specific input
beyond their existing calorie target.

The gram conversion (4 kilocalories per gram of protein or carbohydrate, 9
kilocalories per gram of fat) is the FDA's general energy-conversion
factors for nutrition labeling, codified at [21 CFR
101.9(c)(1)](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9)
(eCFR, accessed 2026-08-26), sourced there to USDA Handbook No. 74. These
are the same factors used on every packaged food's Nutrition Facts label, so
a target computed this way is directly comparable to how consumed
nutrition is already labeled and recorded in this application's own
`NutritionFacts`.

This specification does not vary the distribution by goal type (lose,
maintain, or gain weight), by activity level, or by any other profile
field. A goal-type-sensitive distribution (for example, a higher protein
percentage while losing weight) is a plausible future refinement but needs
its own cited authority and its own review; naming one here without that
review would be exactly the kind of invented formula this sprint was
instructed not to produce. See "Explicit exclusions" and "Unresolved
questions" below.

## Application

`EnergySummary`
(`apps/mobile/src/features/goals-energy/application/energy-summary.ts`)
gains one field:

```ts
export type EnergySummary = Readonly<{
  age: number;
  bmi: BmiResult;
  goal: GoalConfiguration | null;
  maintenanceEnergy: Energy;
  macroTargets: MacronutrientTargets | null;
  restingEnergy: Energy;
  target: Result<Energy, DomainError> | null;
}>;
```

`deriveEnergySummary` computes `macroTargets` as
`calculateDailyMacronutrientTargets(target.value)` when `target` is
non-null and `isErr(target)` is false, and `null` in every other case —
no goal saved, or a saved goal whose adjustment no longer validates against
a maintenance estimate that changed since it was saved. This mirrors
`target` itself: both are `null` under the same conditions, so a screen
already handling `target === null` needs no new branch to also handle
`macroTargets === null`. No change reaches `validateGoalForSummary`,
`GetEnergySummaryUseCase`, or `SaveGoalUseCase` — none of them read or
depend on macro targets.

## Display

`energy-formatting.ts` gains one function:

```ts
export function formatMacronutrientGrams(grams: number): string {
  return `${Math.round(grams).toLocaleString('en-US')} g`;
}
```

This matches `formatDailyEnergy`'s existing rounding and locale formatting
exactly, applied to grams instead of kilocalories.

`GoalsEnergyScreen.tsx` renders three additional lines — "Protein target,"
"Carbohydrate target," "Fat target" — inside the same calculated-target
card that already renders the daily calorie target, immediately after it,
and only when that calorie target itself renders (i.e., `summary.target` is
`Ok`). Each line's helper text states plainly that it is "a general target
based on a fixed macronutrient split within published dietary reference
ranges, not personalized nutrition or medical advice" — language chosen to
match Reps in Reserve's precedent of disclaiming coaching or medical
authority in the field's own copy (Specification 0046), and this
application's standing principle that it is not a medical device
(`PRODUCT.md`).

Per Specification 0034 and [ADR
0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md),
the calculated-target card is one accessibility element whose accessible
name states every value it renders as `label, value` segments in written
order. The three new lines extend that same accessible name with three more
`label, value` segments, in the fixed order protein, carbohydrate, fat —
they do not become a second accessible element, and no new accessibility
plumbing is introduced.

**Implementation note (Sprint 49).** Repository review at implementation time
found that no code reads `EnergySummary.target` for display, and that
`GoalsEnergyScreen.tsx` renders no calorie-target line at all — the
"calculated-target card" referenced above is `CalculatedTargetCard` inside
`GoalConfigurationForm.tsx`, which computes and displays a _live preview_
target from the form's current (possibly unsaved) goal selection, not from
`EnergySummary.target`. `docs/architecture/goals-and-energy.md` already named
this "the goal form's calculated target card" before this sprint. Wiring
macro targets through a new `EnergySummary.macroTargets` field as drafted
above would have added a field nothing reads, alongside the field
(`EnergySummary.target`) it was designed to mirror, which is already unread.
Sprint 49 instead computed `calculateDailyMacronutrientTargets` directly
inside `CalculatedTargetCard`, from the same `target: Energy` prop the card
already renders. `EnergySummary`, `deriveEnergySummary`, and
`GoalsEnergyScreen.tsx` are unchanged. Every acceptance criterion below is met
exactly as stated — the person-visible behavior (a saved, valid goal shows
protein/carbohydrate/fat targets consistent with the shown calorie target;
an invalid or absent goal shows neither) is identical to what "Application"
and "Display" above describe; only the internal wiring differs. Testing
moved from the planned `energy-summary.spec.ts` and `GoalsEnergyScreen.spec.tsx`
cases to `GoalConfigurationForm.spec.tsx`, where the card actually lives.
The domain module (`macro-targets.ts`) and its exports from `@fitness/domain`
were implemented exactly as specified.

## Persistence and migration

None. The migration count stays at 13. The macronutrient distribution is a
frozen module constant, not user data, so it is not read from or written to
`goal_configuration` or any other table. Every value this specification
displays is recalculated on every load from the existing calorie target,
exactly as the calorie target, BMI, resting energy, and maintenance energy
already are (`goals-and-energy.md`, "Persistence and privacy").

## Export and restore

No change. `ExportedGoal`
(`apps/mobile/src/features/data-export/application/data-export-contract.ts`)
already exports only the two fields SQLite persists —
`adjustmentKilocalories` and `goalType` — and never the derived calorie
target, BMI, or resting/maintenance energy. Macro targets are derived from
those same persisted fields and are excluded from the export contract for
the same reason: exporting a recalculable value would let an exported file
disagree with what the application would compute from its other, persisted
contents. The export format version stays at 2.

## Failure and recovery

There is no new write path, so there is no new failure mode. A profile or
goal that already fails to produce a calorie target (age out of range,
missing profile, or a stale goal whose adjustment no longer validates)
continues to produce no macro targets, exactly as it already produces no
calorie target — one existing `null`/error path governs both.

## Offline behavior

Everything above runs entirely on-device, from data already loaded for the
existing Goals & Energy screen. No network call, telemetry, or external
service is introduced or required.

## Accessibility

- The three new lines join the existing calculated-target card's single
  accessible name rather than creating new elements, per ADR 0024.
- Each line's helper text states it is a general target, not personalized
  or medical advice, satisfying the requirement that the application not
  imply coaching or medical authority.
- Presentation-layer rounding and formatting reuse `formatDailyEnergy`'s
  existing pattern, so Dynamic Type and locale formatting behave
  identically for the new values.
- No color, motion, sound, or haptic feedback is added.

## Privacy and security

Macro targets are derived from profile and goal data already classified as
sensitive and handled under Goals & Energy's existing rules: on-device only,
never logged, never sent over a network, and never included in a
user-facing technical error. This specification introduces no new stored
field, so it introduces no new sensitive data to protect.

## Performance

One additional pure function call per Goals & Energy screen load, operating
on values already computed in the same call. Not measurable against the
screen's existing calculation cost.

## Observability

None introduced.

## Testing

- **Domain** (`packages/domain/src/goals-energy/macro-targets.spec.ts`,
  new): for a representative calorie target, the three returned gram values
  match hand-computed expectations from the fixed distribution and the 4/4/9
  conversion factors exactly; the three gram values' calories
  (`proteinGrams * 4 + carbohydrateGrams * 4 + fatGrams * 9`) equal the
  input calorie target's kilocalories exactly, with no rounding artifact,
  for several representative calorie targets including the 1,000-kilocalorie
  floor.
- **Presentation** (`energy-formatting.spec.ts`,
  `GoalConfigurationForm.spec.tsx` — see the Sprint 49 implementation note
  above for why these replace the originally planned
  `energy-summary.spec.ts` and `GoalsEnergyScreen.spec.tsx` cases):
  `formatMacronutrientGrams` rounds and formats like `formatDailyEnergy`;
  the three macro lines render only when the calorie target itself renders,
  and are absent whenever it is (out-of-range adjustment, no goal type
  chosen yet); the calculated-target card's accessible name includes all ten
  segments — calculated target, its value and caveat, the three macro
  `label, value` pairs in protein/carbohydrate/fat order, and the macro
  caveat — in the documented order.
- **Manual, physical device**: a short addition to the existing Goals &
  Energy manual-testing coverage confirming the three new lines are
  announced correctly by a screen reader as part of the existing card, not
  as new elements.
- Not proposed: Maestro, simulator, emulator, or an automated UI regression
  suite, per [ADR
  0033](../docs/decisions/0033-risk-based-manual-device-testing.md).

## Documentation

- This specification.
- [ADR
  0035](../docs/decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md).
- `docs/architecture/goals-and-energy.md` — macro-target formula, evidence,
  and the fixed-distribution rationale added alongside the existing BMI/BMR/
  maintenance/target sections.
- `docs/product-roadmap.md` — Phase 5 split into a macro-target track
  (this specification, approved for Sprint 49) and an unapproved
  food-database-sourcing track (see ADR 0035).
- `specs/0006-goals-and-energy.md` — amended with a pointer to this
  specification, following the pattern Specification 0046 used for
  Specifications 0012, 0032, and 0035, rather than rewriting its own
  "Explicit exclusions" history. The exclusion of "macros" recorded there in
  Sprint 2 was scoped to the calorie-and-goal foundation that specification
  built; this specification is the later, separately reviewed capability
  that phase's exclusion always anticipated needing.

## Rollout and rollback

Ships as a normal release with no migration. An installation that never
opens the Goals & Energy screen after this release is unaffected. A person
with no saved goal sees no change at all; a person with a saved goal sees
three additional read-only lines.

## Explicit exclusions

A user-selectable or goal-type-sensitive macronutrient distribution;
multiple named distribution presets; comparing a macro target against
consumed nutrition (macro "progress" or a balance/deficit view — this
requires joining Goals & Energy with Nutrition data, which neither this
specification nor any prior one approves, and which is closer to Phase 6's
energy-balance question than to this specification's scope); persisting a
macro target; historical macro-target tracking; recommending, adjusting, or
overriding a person's goal based on their macro target; medical, coaching,
or rehabilitation guidance derived from a macro target; any food database,
barcode entry, provider integration, or provenance change (see ADR 0035);
a new package, tab, screen, table, column, migration, or external
dependency; Maestro; simulator or emulator automation; automated UI
regression suites.

## Phase 5 exit-criterion evaluation

Phase 5 exits when "logging a food item finds it in a real database most of
the time, **and** a person has a macro target derived from their own goal
and energy configuration" — a conjunction of two conditions. This
specification, once implemented, satisfies only the second condition. The
first remains unmet and unaddressed, because it depends on an approved
food-data source that [ADR
0035](../docs/decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md)
explicitly declines to approve this sprint. `docs/product-roadmap.md`
records Phase 5 as **Current**, not **Complete**, once this specification
is approved, and will not record it Complete until both conditions are
independently met.

## Acceptance criteria

- A person with a saved, currently valid goal sees a protein, carbohydrate,
  and fat target, each in whole grams, alongside their existing daily
  calorie target.
- A person with no saved goal, or whose saved goal no longer produces a
  valid calorie target, sees no macro-target lines — the same condition
  under which they already see no calorie-target line.
- The three displayed gram values are always consistent with the displayed
  calorie target under the fixed 20/50/30 distribution and the 4/4/9
  conversion factors, for every valid calorie target from 1,000 kilocalories
  upward.
- No new SQLite table, column, migration, export field, or network call is
  introduced.
- The calculated-target card remains one accessibility element whose
  accessible name states every value it renders, including the three new
  ones.

## Unresolved questions

Whether a future sprint should vary the macronutrient distribution by goal
type, activity level, or a person's own preference, and what authority
would justify each variation, is not answered here and is left for that
future sprint's own review. Whether and how a macro target should ever be
compared against logged nutrition is a Phase 6-adjacent question this
specification does not open. Food-data sourcing — the other half of Phase
5 — is addressed separately in ADR 0035 and remains unresolved pending
qualified legal review or a coverage-adequacy evaluation; it is not a
question this specification is scoped to answer.

The repository owner approved this specification as Sprint 48's Nutrition
Depth planning outcome on 2026-08-26, with implementation deliberately
deferred to a subsequent sprint (Sprint 49) rather than built in the same
change.
