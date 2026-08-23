# Product Direction

## Product vision

Build a dependable, privacy-conscious fitness platform that helps people record and understand nutrition, hydration, workouts, body measurements, and goals. The product must remain useful without network access and be capable of growing from a personal daily tool into a commercial service.

## Product goals

- Make common fitness logging fast and reliable on iOS and Android.
- Preserve full logging capability during poor connectivity or complete disconnection.
- Give users understandable insights without making unsupported health claims.
- Protect sensitive fitness and account data by default.
- Maintain an architecture that supports secure cloud synchronization without making the cloud a prerequisite for core use.

## Core principles

- **Offline first:** core logging reads and writes succeed locally.
- **User ownership:** data is exportable and handled transparently.
- **Correctness before novelty:** deterministic product behavior takes priority over AI-generated guesses.
- **Accessible by default:** interfaces support assistive technologies and inclusive interaction patterns.
- **Security and privacy by default:** collect the minimum data needed and restrict access deliberately.
- **Evidence over assumptions:** product and architecture decisions are documented and tested.

## Product scope

The intended product includes nutrition, beverages and hydration, workout planning and logging, body measurements, BMI tracking, goal management, analytics, offline synchronization, secure cloud synchronization, AI-assisted nutrition estimation, notifications, data export, and future health-platform integrations.

## Out of scope

The product is not a medical device and must not diagnose, treat, or replace professional medical advice. Social networking, coaching marketplaces, wearable hardware, and speculative integrations are excluded until explicitly approved.

Phase 0 excludes all business features, authentication, databases, backend endpoints, synchronization, analytics, notifications, and AI.

## Roadmap

1. **Engineering foundation:** monorepo, application shells, quality gates, documentation, and contribution standards.
2. **Domain foundation:** approved domain language, local persistence strategy, and the first vertical feature with tests.
3. **Offline product capability:** local-first logging workflows and resilient user experience.
4. **Cloud services:** authentication, authoritative API behavior, and secure synchronization.
5. **Product expansion:** analytics, notifications, responsible AI assistance, and approved platform integrations.

Offline data export shipped during the offline product capability phase rather than product expansion, because a local export needs no cloud service and portability should not wait behind one. Offline restore followed in the same phase: portability that cannot be reversed leaves a user holding a file they cannot use after reinstalling or replacing a device. Restoring is deliberately limited to an installation that holds no information, because merging and replacing are synchronization and destruction problems that need their own reviewed designs. Deliberate local erasure came next: owning your information includes removing it, and reaching an empty installation should not require hunting through operating-system settings. Deleting is explicit, confirmed, verified before it commits, and never something the application does on its own. Safe replacement then closed the remaining gap, because composing those three operations by hand asked people to delete before they could find out whether their replacement file was usable. Replacing validates the incoming file completely first, offers a copy of the current information without pretending it was saved anywhere, and changes the database in one transaction that either preserves the previous dataset or commits the whole replacement. Merging remains a synchronization problem and remains unbuilt.

With that lifecycle complete, the offline capability phase returned to core
fitness value. Completed workout history now yields deterministic personal
records for a performed exercise, each tied to the workout that proves it. A
record states what the application recorded; it is never a claim about
physiology, strength, or what someone should do next. Comparisons that cannot be
made truthfully are declined rather than approximated, so unlike ways of
recording an exercise are never combined, and assisted work is ranked only
against itself.

Deriving records from history raised the cost of a mistyped entry, so completed
workout history became correctable. A person can open a completed workout, fix a
recorded set, add one the workout never recorded, or delete one that never
happened. Correction is always deliberate and always their own: no catalog edit,
plan change, preference, or background task may rewrite what a workout recorded.
The workout keeps its identity, its times, and everything it captured, and every
derived view follows the corrected facts. The previous value is not kept, and the
application never pretends to show what changed.

Correction kept at least one recorded set in every completed workout, so a
workout recorded entirely by mistake — started by accident, recorded twice, or
performed by somebody else on a shared device — could not be corrected away. One
completed workout can now be deleted on its own, after a confirmation that says
what disappears. Deletion is never silent and never a side effect: it removes
that workout and the sets it recorded, leaves everything else exactly as it was,
and cannot be undone. Erasing everything stopped being the only way to remove one
false workout.

Correction could empty an exercise but never remove it, so an exercise added by
mistake, logged twice, or belonging to somebody else on a shared device left only
bad choices: an empty exercise that still showed its planned target, or deleting a
whole workout containing correct work. One completed exercise can now be removed
on its own, after a confirmation that names it and says how much recorded work
goes with it. The rest of the workout is kept, the surviving exercises keep their
identity and order, and a removal that would leave a workout with nothing recorded
is refused in words that point at deleting the workout instead.

Every one of those acts subtracts. Work that was performed but never logged had
no remedy at all: the only way to record it was a second workout that never
happened, which inflates the completed workout count and elapsed workout time and
lies about when the work occurred. One exercise can now be added to the completed
workout it belongs to, with the first set it recorded, entered in the same
action. It is added at the end, every exercise already in the workout keeps its
identity, order, and captured detail, and the workout's own start and completion
times never move. The application does not claim to know the work happened — the
interface asks the person to record what they performed, and records their claim.
With addition, a completed workout's results, its exercises, and the workout
itself can each be corrected, reduced, extended, or deleted by their owner.

That left one thing about a workout its owner still could not touch: what it was
called. Every workout started empty was named `Workout`, so history listed rows
that differed only by date and a personal record announced its evidence as
`in Workout`, a claim that names nothing. A workout of either status can now be
renamed by the person who performed it, and every surface that shows a workout's
name shows the chosen one — including the evidence beneath a personal record. A
name is a label its owner chooses, not a fact the workout observed, so renaming
is not correction and changes no recorded result, total, time, record, or tie.

Naming made history's rows distinguishable, which made an older incoherence
obvious: the screen offered a day, week, or month, computed its summary for the
chosen one, and then listed workouts from any period at all. Somebody reading a
July summary scrolled into August workouts beneath it, and a period holding
nothing showed zeroes above unrelated cards. The selected period now governs the
list as well as the summary, so the two describe the same span of time. A workout
belongs to the period it started in, which is the period that already counted it,
so one performed across midnight is never split between a list and a total. A
period holding no workouts says so in its own words, rather than borrowing the
sentence that means somebody has never trained at all. Nothing recorded changed:
no result, set, time, total, record, tie, or evidence link.

Every one of those capabilities assumed the person already had exercises to
train with, and a new installation has none. The Exercise Library's first screen
was an empty list and an invitation to author definitions by hand, choosing
equipment, a muscle group, and a logging mode before there was any reason to
know what those mean. The library now offers a starter set the person can add in
one deliberate action, covering every way the application records work and
including exercises that need no equipment at all. It is offered, never seeded:
an installation holds nothing until the person asks, which is what keeps
restoring a saved export onto a new device possible and keeps erasing everything
a way back to an empty installation. What it adds is theirs from the moment it
exists — renameable, re-classifiable, deletable, and exportable — and a
definition they already wrote is never overwritten, never duplicated, and always
reported as left alone. The application offers content; it does not endorse these
movements, rank them above what the person writes, or tell anybody how to train.

Recording caught up with reading last. Both daily screens — the nutrition diary
and hydration — let a person walk back through their days, and both then offered
an add control that recorded to today regardless. Someone who remembered last
night's dinner the next morning moved to yesterday, followed the screen's own
invitation to add something to it, and got an entry on a day they were not
looking at while the day they were looking at still read as empty. Navigating to
a day and logging to it are now the same act. A day that has not happened is
simply not offered, because the application has always refused to record into the
future and a screen should not propose what it will decline. Nothing already
recorded moved, no total was recalculated, and correcting an entry's day is still
the same editable field it always was — what changed is that the application now
defaults to the day the person is actually looking at.

Reading caught up with counting after that. The Progress tab read five values
out of storage or derived them on every load — an average per logged day for
protein, carbohydrate, and fat, the part of a period's fluid that was not plain
water, and an average plain water per logged day — typed all five, and displayed
none of them. Somebody tracking protein saw a period total, the question almost
nobody asks, while the daily average they actually track against was computed
and thrown away. Somebody who drinks coffee and water saw a total and a water
figure and had to subtract to learn the third number the daily hydration screen
names outright. Progress now states everything it counted. Each average says
which value it averages and divides by the days that were logged, the count
shown beside it; an unknown average reads exactly as an unknown total already
did; and a value the application cannot compute is left unsaid rather than
shown as a zero. Nothing recorded changed: no entry, amount, total, target, or
export.

Giving back caught up with asking after that. The entry form asks a person for
six optional nutrients, the database stores six, and the nutrition diary totals
six for a day and says which of them are incomplete. A week or a month showed
three. Somebody who filled in sodium at every meal — the number people are most
often told to watch and the one nobody can estimate — could read today's sodium
and never this week's, and the blank where that line should have been read like
an app that does not track sodium at all rather than one that had been asked to.
A period now counts every nutrient a day counts, in the same order and the same
words, with sodium in the milligrams it was recorded in. Where an entry left a
nutrient blank, the period says `Incomplete` for it, exactly as it already did
for protein — silence became a truthful unknown. The Nutrition card is
substantially taller for it, which is the accepted price of not making a person
guess which nutrients the application will hand back. Nothing recorded changed:
no entry, amount, daily total, target, or export.

The same audit reached the workouts beside it last. The Progress Workouts card
read eight values out of a period and stated five. The three it kept quiet about
were the three that say how much work was done — how long you actually worked,
how far you went, and how much you lifted — and all three were already being
counted on every load and shown on the Workout History screen instead. Somebody
who runs, rows, cycles, or holds a plank opened the tab called Progress and found
a workout count, a set count, an exercise count, and a clock reading of how long
they were in the gym. Nothing about the running. A card can be honest about every
number on it and still leave a person with no answer to the question they came
with. The card now states each dimension the period recorded, in the order and
the words the history screen already used, and each line appears only when there
was something of that kind to report rather than claiming a zero nobody did. The
one total that deliberately counts weighted sets and not assisted ones says so
every time it appears, and says so when there was none. Nothing recorded
changed: no workout, set, result, record, or export.

Each phase requires a reviewed specification. The roadmap expresses direction, not a promise of scope or schedule.

## Direction from here

The offline capability phase produced a product that records nutrition, hydration, training, and body weight without a network, and states what it recorded. Two things are true of it at once: nutrition is deeper here than in most fitness applications, and training is shallower than in the best of them. The direction from here closes that gap and then joins the two, while keeping the offline guarantee above intact.

The direction was informed by studying a mature open-source workout tracker. What that study produced was knowledge of the capabilities a serious training log needs and a visual direction — not code. That application is licensed under the AGPL, this one is private and unlicensed, and no line of its source is used or may be used. Anything traceable to it is reimplemented against this repository's own domain model and design system. The material this direction may and may not use is registered in [docs/third-party-material.md](docs/third-party-material.md), including exercise media that cannot be shipped without a separate license from its rights holder.

The phases below are sequenced by the cost of doing them late rather than by visible value.

1. **One visual identity.** A deliberate dark, high-contrast identity, proven by contrast assertions rather than by inspection, plus the display components the screens have already demonstrated a need for. It goes first because it is the cheapest change in the program — the design system's token boundary means the palette is one file with no screen edits — and because every later phase then arrives in the final visual language rather than needing a second pass. The display components a screen needs turned out to be fewer than the phase originally assumed: most of the proposed set had no consumer, and two had no data to draw, so they are admitted by the phases that produce their consumers. Specified in [Specification 0041](specs/0041-the-app-has-one-visual-identity.md).
2. **A schema synchronization can be added to.** Update time, a deletion tombstone, a revision, and an originating device on every table a person owns, plus a record of local changes not yet sent anywhere. No synchronization is built and nothing reaches a network. This is second on purpose: the migration is small, but making deletion a tombstone changes every read path that currently assumes a deleted row is gone, and that cost is paid once against today's tables or repeatedly against every table added before it. It is also the design work the offline-first philosophy above requires before synchronization may be implemented.
3. **A usable exercise library.** The library ships empty and offers twenty-six starter definitions. An openly licensed dataset raises that by orders of magnitude, and obliges the repository to carry the attribution that dataset requires.
4. **Training depth.** Rest timing within a session, effort recorded as reserve or exertion, estimated maxima, grouped sets, and progression schemes — the capabilities that separate a log of what happened from a tool that informs what to do next.
5. **Nutrition depth.** A real food database behind the existing catalog, barcode entry, and macronutrient targets derived from the goal and energy calculations already shipped.
6. **Energy balance.** Intake measured against expenditure, derived on the device from data a person already logs. It depends on both pillars being deep, which is why it follows them, and it is the capability neither pillar has alone.
7. **Cloud services.** Authentication, authoritative server behavior, and reconciliation, as the roadmap above already describes. Phase 2 is what makes this an addition rather than a rewrite.

Three decisions are settled. The visual identity is a change of token values rather than a new theme abstraction, which keeps a user-selectable theme additive if it is ever wanted. A screen's primary action belongs to that screen rather than to the tab bar, because a single action button in the tab bar assumes one dominant activity and this product has two. Cloud-readiness is schema work rather than service work, and phase 2 adds no endpoint, account, or network call.

Two questions are open and each blocks its phase. How much exercise data ships inside the application, given that the complete multilingual dataset is far too large to bundle and the likely answer trades a smaller offline catalog against images fetched on first use. And how food product data is obtained without inheriting a share-alike obligation on a derived database — a question whose convenient answer, querying a public database live, costs offline barcode lookup and therefore argues with the offline-first philosophy above rather than merely being a licensing detail.

## Offline-first philosophy

Food, beverage, water, workout, weight, and measurement logging must not require a network round trip. Mobile owns the immediate offline experience and local interaction model. The backend becomes authoritative when data participates in cloud services, but synchronization must reconcile state rather than block local work.

SQLite is the planned local persistence technology; cloud synchronization comes later. Conflict behavior, identifiers, clocks, deletion semantics, and recovery rules must be designed together before synchronization is implemented.

## Non-functional requirements

- **Availability:** core logging remains available offline.
- **Reliability:** writes are durable, recoverable, and protected from partial failure.
- **Performance:** routine interactions should feel immediate on supported devices.
- **Security:** secrets, personal data, dependencies, and access boundaries receive explicit review.
- **Privacy:** data collection, retention, processing, and export are understandable and minimized.
- **Accessibility:** supported flows target WCAG-aligned mobile accessibility practices.
- **Maintainability:** feature-first modules, strict types, pure domain rules, tests, and durable decisions reduce change risk.
- **Observability:** future services expose actionable, privacy-safe diagnostics without logging sensitive data.
- **Portability:** users can export their information in documented formats, restore it offline into an installation that holds no information yet, replace everything stored on the device with a validated export in one all-or-nothing operation, and delete everything stored on the device in one deliberate, verified action, and
  correct a recorded set inside a completed workout, remove one exercise from it,
  add one exercise that was performed but never logged, rename the workout they
  performed, or delete one completed workout, instead of losing everything to fix
  one mistake.
- **Scalability:** architecture evolves from demonstrated constraints rather than premature distribution.
