# ADR 0034: Reps in reserve is a recorded observation, not a derived estimate

**Status:** Accepted

**Bounds:** [ADR 0017](0017-deterministic-workout-personal-records.md), which
rejected estimated one-repetition maximum as personal-record evidence, by
naming the distinction that keeps this capability outside that rejection.

## Context

Three prior specifications named reps in reserve (RIR) or its cousin, rate of
perceived exertion (RPE), and every one of them excluded it: Specification
0012 (offline workout planner), Specification 0032 (recorded result meaning),
and Specification 0035 (owner-named workouts). None of the three argued RIR
was impossible or unwanted — each simply had a narrower scope and deferred it.
[The product roadmap](../product-roadmap.md#training-depth-direction-provisional)
recorded, after Sprint 45's discovery, a stronger-sounding reason RIR shipped
after rest timing rather than first: "it adds a subjective, contested field to
a codebase whose stated principle is correctness before novelty and
deterministic behavior over guesses."

That reasoning, taken at face value, would exclude RIR permanently, not just
sequence it second. It also appears to collide with [ADR 0017](0017-deterministic-workout-personal-records.md),
which refused to rank an estimated one-repetition maximum as personal-record
evidence because "it is not a recorded fact." If RIR is also an estimate, the
same sentence forbids it.

The two are not the same shape of value, and the difference is what this ADR
names so the next candidate — RPE, or anything else framed as a person's
subjective report — can be evaluated against a stated rule instead of
re-litigating this tension from scratch.

An estimated one-repetition maximum is **computed by the application** from a
lighter, actually-performed set, using a formula that is one of several
competing formulas, none of which the lifter chose or asserted. It is
deterministic in the sense that the same inputs always produce the same
output, but the output is a claim about a weight nobody lifted. ADR 0017's
"not a recorded fact" refers to exactly this: the application inferring a fact
about the world that no one told it.

Reps in reserve is different in kind, not just in scope. **The application
computes nothing.** The number that gets stored is the number the person
typed, describing their own subjective sense of how many more repetitions
they believed they could have done. The recorded fact is not "you had 2 reps
left" — the application has no way to know that and never claims to — the
recorded fact is "this person, at this moment, believed they had 2 reps
left." That belief is exactly as recorded, and exactly as fallible, as the
repetition count and resistance value beside it, which are also unverified
person-supplied claims the application has always stored without
independently confirming.

## Decision

**A person's own subjective report is a recorded fact about what they
reported, even though it is not a verified fact about their physiology.**
This is the line ADR 0017 draws implicitly and this ADR states directly: the
application may store what a person tells it about themselves, and must not
compute, infer, or recommend a value standing in for what they did not tell
it. Reps in reserve is squarely the first category. Estimated one-repetition
maximum, and any future "estimated" or "recommended" value the application
would compute rather than transcribe, remains squarely the second and remains
excluded by ADR 0017 unless a later ADR supersedes it.

**The application takes no position on whether a reported value is
accurate, meaningful, or good.** It is presented as what it is — a person's
own estimate — using language that neither validates nor challenges it. See
[Specification 0046](../../specs/0046-record-reps-in-reserve.md) for the exact
presentation rules this produces.

**This does not reopen RPE.** RPE was excluded for the same subjective-report
reasons stated in Specifications 0012, 0032, and 0035, and this ADR does not
approve it: RPE's typical 1–10 or 6–20 scale carries external anchors (a
perceived-exertion chart) this application does not display or endorse, and
its overlap with RIR as a second subjective effort scale was not designed
together. A future sprint proposing RPE should read this ADR's line and reach
its own conclusion about whether RPE also sits on the "recorded self-report"
side of it — this ADR neither answers that question nor forecloses it.

## Consequences

- The roadmap's Sprint 45 note is superseded in effect, not in wording: this
  ADR is the reviewed record of why RIR is not "a subjective, contested field"
  in the sense that sentence warned against. The roadmap's material change log
  records the correction; the historical sentence is not rewritten.
- A future capability proposed as "the application's own estimate of X" must
  clear ADR 0017's bar. A future capability proposed as "what the person
  reported about X" may clear this ADR's bar instead, on its own review.
- Nothing about deterministic personal records, comparisons, or history
  changes. Reps in reserve carries no comparison semantics, contributes to no
  personal record, and is declared as such in
  [Specification 0046](../../specs/0046-record-reps-in-reserve.md).

## Alternatives considered

**Leave RIR excluded and wait for a stronger product signal.** Rejected: the
phase's exit criterion asks for an observation of effort or pacing, RIR is the
smallest one available, and the correctness concern the roadmap raised is
answered rather than outstanding.

**Silently ship RIR without addressing the apparent conflict with ADR 0017.** Rejected: the conflict is visible to any future reader who compares
the two documents, and leaving it unaddressed invites either a wrong future
exclusion (treating every subjective field as forbidden) or a wrong future
inclusion (treating ADR 0017 as no longer binding).

**Amend ADR 0017 directly.** Rejected: ADR 0017 is correct and unaffected —
it never claimed to speak to person-reported values, and nothing about its
personal-record derivation rules changes. A new ADR that states the boundary
is more honest than editing a settled decision to retroactively appear to
have anticipated a distinction it did not need at the time.
