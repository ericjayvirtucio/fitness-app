# ADR 0024: Let a labelled container announce its contents, and leave a container holding a control unlabelled

**Status:** Accepted

**Generalizes:** [ADR 0023](0023-displayed-totals-state-their-coverage.md), which
decided that one labelled summary card's accessible name carries its contents, as
a consequence of a decision about totals rather than about naming.

## Context

`Card` couples naming to grouping. A card carrying an `accessibilityLabel`
renders as a `View` with `accessible={Boolean(accessibilityLabel)}`, or as a
`Pressable`, and in both cases it becomes one accessibility element whose
children never reach the accessibility tree.

That is correct for a pressable card, whose name describes the act the press
performs. It is silent data loss for a static card whose label is a section title
and whose children are the information.

[ADR 0023](0023-displayed-totals-state-their-coverage.md) met this on the Workout
History summary and fixed it there: a coverage sentence only sighted users could
read did not satisfy that rule, so the card's name became its contents. Fixing
one card did not decide the class.

An audit of all 56 card usages found 20 labelled. Eleven already carried their
contents. Seven announced a static title while their children carried every value
— including the BMI, the screening category, the resting and maintenance energy
estimates, the calculated daily calorie target, and the whole day's nutrition
totals. None of those numbers reached a screen reader.

One labelled card was worse than silent. The hydration target progress card
carried a composed name and also contained a `Change daily target` button, so the
button never reached the accessibility tree at all. The evidence was already in
the repository: no Maestro flow and no test has ever referenced that control,
while its sibling `Set daily target`, in the unlabelled card beside it, is tapped
by an end-to-end flow and asserted by a unit test. The reachable control was used;
the hidden one never was. There is no other route to the hydration target screen,
so a screen-reader user who had set a target could not change it.

`Screen` looks similar and behaves differently. It never sets `accessible`; its
label reaches the inner scroll view through prop spread, names the region, and
hides nothing. `SelectionField` has the same shape and its radios stay reachable.
The coupling is `Card`'s alone.

## Decision

**A labelled container's accessible name is its identity phrase followed by every
string it renders, in render order.** A rendered heading that only restates the
identity phrase is omitted as a duplicate; a heading that carries a value is not.

**A container whose children include a control is not labelled at all.** No name
recovers a control the name has hidden. Such a container carries no
`accessibilityLabel`, and its text and its controls reach the tree individually.

**A pressable container leads with the act, then its contents.** `Open`, `Add`,
`Edit`. A pressable container must stay one element, because splitting it would
leave a button with no name.

Three consequences are part of the decision.

**The rule is composed once, and it is not enforced by the design system.**
`Card` exports `describeCardContents(identity, lines)`, which joins an identity
phrase and the rendered lines. Every screen obeying the rule uses it, so there is
one composition path rather than one per screen. `Card` does not compose its own
name from its children: doing so would require walking `ReactNode` through the
views, fragments, and conditionals every affected card already nests; it would
produce render order, which is wrong for every pressable card whose name must
lead with the act; it could not be opted out of without a prop that recreates the
manual path; and it would silently rewrite the names of the eleven cards that are
already correct.

**The name is built from the same values the render maps over.** No screen
invents a sentence it does not display, and no screen formats a value twice. A
name that varies with the data varies because the rendered lines varied; a card
whose values are partly absent announces the shorter contents and claims nothing
about the absent ones.

**A container that renders an error instead of values is a different subtree.**
Every affected screen already replaces its content with a labelled error `Screen`,
so no stale value can be announced.

Persist nothing. No migration, index, column, constraint, dependency, domain
change, query change, use-case change, reader-contract change, or export-format
change. No visible string changes, and no stored value, total, record, tie, or
evidence link changes.

## Consequences

- Roughly twenty values across five screens become audible for the first time,
  and one control becomes usable for the first time.
- A card's name is the only string an end-to-end run can match inside it, so six
  claims become assertable that could not be stated before: that the completed
  workout detail shows a set count and a workout time, that the correction and
  addition screens state what they change, that the nutrition diary shows a daily
  total, that Goals & Energy shows a BMI and its energy estimates, and that the
  goal form shows a calculated target.
- Dropping the hydration card's label rewrites two assertions in one flow that
  nine suites depend on. The replacement asserts the control, which is stronger
  evidence than the name it replaces.
- A totals card announces as one long utterance rather than several stops. That
  is a deliberate trade: a totals block is one thing, and both screen readers
  interrupt an utterance on the next swipe. A card that reads as too long is
  unlabelled instead — a one-line change, by the same rule.
- The rule stays repeatable rather than enforced. A future screen can still label
  a card and lose its children. That is accepted, and mitigated by this record,
  by the mobile development guide, by the end-to-end selector traps, and by a
  design-system test asserting the contract directly.
- `Screen`, `SelectionField`, and every other labelled container that does not set
  `accessible` are explicitly outside the rule, because they hide nothing.

## Alternatives considered

- **Let `Card` compose its own name from its text children.** Rejected on four
  grounds, stated in the decision. It is the version that makes the defect
  unrepeatable, and it is magic a screen cannot opt out of.
- **Drop the label on all seven cards and let the children announce.** Rejected.
  It is right where a control forces it and wrong elsewhere: the nutrition totals
  card would become nine stops for one totals block, and every card would lose the
  region identity that tells a person what they have landed on.
- **Use `accessibilityValue` beside the label.** Rejected. It carries one value;
  these cards carry up to nine.
- **A `describe*` function per screen, with no shared helper.** Rejected. Six
  copies of one join are six chances to diverge, and this repository has just
  spent a sprint removing a second formatting path.
- **Keep the hydration card labelled and move its button outside it.** Rejected.
  It changes visible layout to solve a naming defect, and it leaves the same trap
  for the next author.
- **Make the hydration card pressable so the card is the control.** Rejected. It
  turns a static card into a button and duplicates an action the card already
  renders.
- **Announce a card's rendered heading even when it restates the identity
  phrase.** Rejected. `Workout progress summary, Performed summary` states one
  thing twice, and it would change a name shipped by ADR 0023 for no gain.
- **Fix the hydration control in a later sprint.** Rejected. It is the most
  serious finding of the audit that produced this decision, and deferring it would
  bury a lost control under an announcement gap.
