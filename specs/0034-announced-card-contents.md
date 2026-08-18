# Specification 0034: Announced card contents

- Status: Approved
- Date: 2026-08-18

## Objective and scope

Make every element that announces itself as one thing announce everything it
shows, so nothing a sighted person reads is silently unavailable to a screen
reader, and so no element hides a control behind a name.

[Specification 0033](0033-summary-total-coverage.md) fixed one card and, in doing
so, found the class. A `Card` carrying an `accessibilityLabel` is one
accessibility element: its children never reach the accessibility tree. Seven
further cards announce a static title while their children carry every value. An
eighth additionally hides a button.

Version 1 changes nine accessible names and no visible string, all in
presentation.

`@fitness/domain`, `apps/api`, every migration, user version 11, export format
version 1, the restore parser, local erasure, replacement restore, every reader
contract, every query, every use case, every composition root, personal records,
correction, removal, addition, the Exercise Catalog and its filtering, all three
pickers, and the Workout Planner are untouched. No stored value, result kind,
record, tie, or evidence link changes. No total's numeric value changes.

Charts, Progress redesign, changing any displayed value or sentence, changing how
any total is calculated, new record categories, adherence, streaks, coaching,
starter Workout Plans, onboarding, localization, export format changes, cloud
synchronization, authentication, AI, notifications, dependency upgrades, and a
general design-system accessibility overhaul beyond the elements this audit names
remain excluded.

## The gap this closes

`Card` renders a labelled, non-pressable card as a `View` with
`accessible={Boolean(accessibilityLabel)}`, and a pressable card as a `Pressable`
with `accessibilityRole="button"`. In both cases the card is one accessibility
element and its children are not individually reachable. `Screen` looks similar
and is not: it never sets `accessible`, its label arrives through prop spread,
and it hides nothing. `SelectionField` has the same shape as `Screen` and its
radios stay reachable. The coupling belongs to `Card` alone.

The application contains 56 card usages. Twenty carry an `accessibilityLabel`.

**Eleven are already correct.** Their names carry their contents, or lead with
the act a press performs and then carry their contents: the Workout History
summary and both of its pressable cards, both cards on the exercise performance
screen, the Progress daily row, the nutrition diary entry card, the body
measurement entry card, the exercise picker row, the planner day card, and the
hydration daily totals card.

**Seven announce less than they show.**

| Card                             | Announced today                    | Not announced                                                       |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Completed workout summary        | `Completed workout summary`        | the actual set count and the workout time                           |
| Correction consequence           | `What this correction changes`     | the paragraph stating what a correction or an addition changes      |
| Addition consequence             | `What this addition changes`       | the paragraph stating what the addition changes                     |
| Daily nutrition totals           | `Daily nutrition totals`           | the day's energy, entry count, six nutrients, and completeness note |
| BMI screening result             | `BMI screening result`             | the BMI and its screening category                                  |
| Profile-derived energy estimates | `Profile-derived energy estimates` | the BMI, category, resting energy, and maintenance energy           |
| Calculated daily calorie target  | `Calculated daily calorie target`  | the calculated target and its caveat                                |

Two of them compound the loss. The Goals & Energy cards contain `Metric` views
that already carry correct names of their own, and the goal form's value carries
its own name. Those names are computed on every render and reach nobody.

**One is worse than silent.** The hydration target progress card carries a
composed name and contains a `Change daily target` button. The button never
reaches the accessibility tree. The evidence was already in the repository: no
end-to-end flow and no test references that control, while its sibling
`Set daily target`, in the unlabelled card beside it, is tapped by
`flows/hydration/log-water-and-persist.yaml` and asserted by
`HydrationDailyScreen.spec.tsx`. There is no other route to the hydration target
screen, so **a screen-reader user who had set a target could not change it.**

**One announces what it does not display.** The Progress body weight caption
carries a six-clause summary of the metrics above it while displaying a single
sentence. Those metrics are already individually navigable, so the name repeats
what was just spoken, in wording that differs from the sentence on screen.

No data is wrong and nothing is unreachable by touch, except the one control. The
application declines to speak what it has already written, and in one place
declines to offer a control it has already drawn.

## The rule

**A labelled container's accessible name is its identity phrase followed by every
string it renders, in render order.** A rendered heading that only restates the
identity phrase is omitted as a duplicate; a heading that carries a value is not.

**A container whose children include a control is not labelled at all.**

**A pressable container leads with the act, then its contents.**

[ADR 0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md)
records the rule, the decision not to enforce it in the design system, and the
alternatives rejected.

## Announced names

Values shown are the ones the test fixtures produce.

| Element                                        | Before                                                                                                                                                                                                   | After                                                                                                                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CompletedWorkoutScreen` summary               | `Completed workout summary`                                                                                                                                                                              | `Completed workout summary, 6 actual sets, 45 min 0 sec workout time`                                                                                                                                     |
| `CompletedWorkoutSetCorrectionScreen`, editing | `What this correction changes`                                                                                                                                                                           | `What this correction changes, Correcting changes what this workout recorded. Personal records and progress may change. The workout stays completed, and its exercise and plan details are unchanged.`    |
| `CompletedWorkoutSetCorrectionScreen`, adding  | `What this correction changes`                                                                                                                                                                           | `What this correction changes, Adding records a set this workout did not record. Personal records and progress may change. The workout stays completed, and its exercise and plan details are unchanged.` |
| `CompletedWorkoutExerciseAdditionScreen`       | `What this addition changes`                                                                                                                                                                             | `What this addition changes, ` followed by `additionSaveExplanation`                                                                                                                                      |
| `NutritionDiaryScreen` totals                  | `Daily nutrition totals`                                                                                                                                                                                 | `Daily nutrition totals, 89 kcal, 1 entry, Protein: 1.1 g, Carbohydrate: 22.8 g, Fat: 0.3 g, Fiber: 2.6 g, Sugar: 12.2 g, Sodium: 1 mg`                                                                   |
| `GoalsEnergyScreen` BMI card                   | `BMI screening result`                                                                                                                                                                                   | `BMI screening result, BMI, 24.5, Screening category, Healthy weight`                                                                                                                                     |
| `GoalsEnergyScreen` estimates card             | `Profile-derived energy estimates`                                                                                                                                                                       | `Profile-derived energy estimates, BMI, 24.5, Screening category, Healthy weight, Estimated BMR, 1,700 kcal/day, Estimated maintenance, 2,635 kcal/day`                                                   |
| `GoalConfigurationForm` target card            | `Calculated daily calorie target`                                                                                                                                                                        | `Calculated daily calorie target, Calculated target, 2,135 kcal/day, Based on estimated maintenance and your selected adjustment. Results are not guaranteed.`                                            |
| `HydrationDailyScreen` target progress card    | `Fluid target progress, 500 mL of 3 L, 17%`                                                                                                                                                              | no name; announces as `Daily fluid target`, `17% complete`, the remaining sentence, and `Change daily target, button`                                                                                     |
| `ProgressScreen` body weight caption           | `Body weight progress. First recorded weight 80 kilograms. Latest recorded weight 78 kilograms. Recorded change down 2 kilograms. 4 check-ins. This describes recorded check-ins, not a measured trend.` | the sentence it displays                                                                                                                                                                                  |

Deliberately unchanged: all eleven already-correct labelled cards; every labelled
`Screen`; every `AppButton`; `SelectionField`; `Metric` in both screens;
`describePersonalRecord`; `describeBodyWeightEntry`. The Workout History summary
keeps its shipped name exactly, and is moved onto the shared helper so that its
string is produced by the same path as every other card.

The correction card's identity phrase says `correction` on the branch that adds a
missing set. That predates this change and is a visible-vocabulary decision rather
than a naming one; the appended contents now disambiguate it in the same
utterance, and rewording it is left out of scope.

## Ownership

The content belongs to each screen. The contract belongs to the design system.

`Card` exports:

```ts
export function describeCardContents(
  identity: string,
  lines: readonly string[],
): string;
```

It joins the identity phrase and the rendered lines with `, ` and returns the
identity alone for an empty list. Every screen obeying the rule uses it, so there
is one composition path rather than one per screen, and the contract is asserted
directly in the design system rather than only through screens.

`Card`'s props do not change. `Card` does not compose its own name from its
children; ADR 0024 records why, and what that costs.

Each call site builds the array it renders from and maps the same array into the
name, so the announced sentence is the read sentence by construction and no value
is formatted twice.

## Error model

Nothing is written and no new failure mode exists.

| Case                       | Outcome                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Values entirely absent     | Every affected card is already rendered conditionally by its screen. When the card does not render, nothing is announced.              |
| Values partly absent       | The rendered lines are fewer, so the name is shorter. Nothing is claimed about the absent values.                                      |
| An error instead of values | Each screen replaces its content with its own labelled error `Screen`, so the card does not exist and no stale value can be announced. |
| Children include a control | The container carries no label. Its text and its control reach the tree individually.                                                  |

Concretely: the nutrition totals card renders `Incomplete` for an unknown nutrient
and appends its existing explanation only when at least one is unknown, and both
flow into the name; the Goals & Energy BMI card renders only when a BMI exists;
the goal form renders a live-region message and no card when the preview is
invalid; the Progress recorded-change metric is already conditional.

No error text changes. Nothing interpolates SQL, table names, identifiers, paths,
or stack traces; every message continues to come from the fixed-sentence modules.

## Experience and accessibility

No visible string changes anywhere. Every new announcement is assembled from
string expressions the same component already renders, in the same order, so no
screen invents a sentence it does not display and no card changes height.

Every changed card keeps its role. The hydration target card loses a role it
should not have had: it stops being one element and becomes four, the last of
which is a button with the accessible name `Change daily target` and the touch
target it always had visually.

The longest utterance is the nutrition totals card, at roughly thirty-two words
with every nutrient known. That is comparable to the Workout History summary and
to `describePersonalRecord`, both already in production. A totals block is one
thing and reads naturally as one utterance; both screen readers interrupt an
utterance on the next swipe, which bounds the cost of length. A card that reads as
too long is unlabelled instead, which is a one-line change under the same rule.

No `numberOfLines` exists anywhere in the application, and `Card` lays its
children out in a column with no height constraint, so at the largest accessible
text size every changed card wraps and grows taller and nothing truncates.
Announcement length does not vary with text size.

No control label, heading, empty state, or alert changes. No control is added.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, or dependency is involved. No
SQL text changes, no query changes shape, no query is added, and every parameter
stays bound. Nothing is logged. An accessible name carries only what the screen
already displays, so no value becomes newly observable.

Composition is one array literal and one join per affected card render, on data
already computed for the render. Two screens gain one small array allocation each;
the hydration and Progress screens do strictly less work than before. No
additional query and no additional render is introduced.

## Data lifecycle

Stored values, result kinds, and logging mode snapshots are byte-identical. Every
total's numeric value is unchanged. Personal records, their categories, values,
ties, and evidence are unaffected. The Planner's stored data, the Exercise
Catalog, and its filtering are unaffected. Export, restore, erasure, and
replacement are unaffected; no exported field carries an accessible name and
export format version 1 is unchanged. Correction, removal, and addition change no
behavior.

Data recorded before this change reads correctly after it, because only the
composition of a name changed and every value it composes was already rendered.

## Verification and completion

React Native Testing Library does not model the platform `accessible` grouping, so
a unit test cannot prove a child is hidden. Tests therefore assert the accessible
name, which it does model faithfully, and the rendered text; the grouping contract
is recorded here, asserted in the design system, and proven on device.

Automated coverage:

- each changed element announces exactly what it displays, asserted through its
  accessible name against the exact strings above;
- an element whose values are partly absent announces the shorter contents and
  claims nothing about the absent ones;
- an element rendering an error state announces the error, not stale values;
- `Change daily target` is reachable by role and name and invokes its action;
- no visible string changed on any touched screen, asserted by rendering each
  changed card's text alongside its new name;
- `describeCardContents` joins an identity and its lines, and returns the identity
  alone for an empty list, asserted in the design system;
- a labelled card exposes its label and is one element; an unlabelled card is not;
- every pre-existing assertion that did not concern accessible naming passes
  unmodified, including the Workout History summary's name across the helper
  refactor.

End-to-end coverage adds a Sprint 34 suite and one regression scenario. Six claims
become assertable that could not be stated before, because a card that announced
only its title could never be proven to show anything. One existing flow changes:
`flows/hydration/log-water-and-persist.yaml` stops asserting a card name that no
longer exists and asserts the visible progress sentence and the control instead,
which is stronger evidence than the name it replaces.

## Explicit exclusions

Changing any displayed value or sentence; rewording the correction card's identity
phrase; changing how any total is calculated; letting `Card` compose its own name;
a lint rule forbidding a control inside a labelled card; specifications for the
four Nutrition screens that have none; removing the stale worktree; new or changed
personal record categories; charts; Progress redesign; achievements, badges,
streaks, or adherence; coaching, progression advice, or medical interpretation;
starter Workout Plans; starter content changes; onboarding; localization; export
format changes; cloud synchronization; authentication; backend endpoints; AI;
notifications; dependency upgrades; repository-wide refactoring.
