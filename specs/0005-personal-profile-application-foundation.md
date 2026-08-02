# Specification 0005: Personal profile and application foundation

- Status: Approved
- Date: 2026-08-02

## Objective and scope

Deliver the first complete offline mobile capability and establish the application
use-case pattern for future features. One local personal profile stores height,
weight, biological sex, date of birth, activity level, and preferred metric or
imperial units. Users can create, read, and update it without authentication or
network access.

The supported biological-sex values are female, male, intersex, and prefer not to
say. Activity levels are sedentary, lightly active, moderately active, very active,
and extremely active. Height must be 50–300 centimeters and weight 2–500 kilograms.
Date of birth is a real `YYYY-MM-DD` calendar date no later than the current date.

## Architecture

The thin Profile route renders capability-owned presentation. Presentation calls
`GetProfileUseCase` and `SaveProfileUseCase`; use cases depend on the
`PersonalProfileRepository` contract and existing `TransactionRunner`. Mobile
SQLite infrastructure implements the contract and maps storage through validated
`@fitness/domain` values. Dependencies never point from domain or application code
to React, Expo, SQLite, or SQL.

`SaveProfileUseCase` converts display units to canonical millimeters and grams,
collects domain validation errors, and saves through a transaction-scoped
repository context. Expected validation returns structured results. Unexpected
storage failures are translated and presented without raw SQL, parameters, or
personal values.

## Persistence, privacy, and recovery

Forward-only migration 2 creates `personal_profile`. A constrained primary key of
`1` enforces the single local record without defining future cloud identity.
Measurements use canonical numeric units; date and supported options use text with
database checks. Save is a bound-parameter upsert. No deletion, timestamps, sync
metadata, or account identifier is included.

The operating-system application sandbox and device encryption are the approved
Sprint 5 confidentiality boundary. The SQLite file has no application-level
encryption. The app minimizes stored fields and never logs profile values. A
stronger attacker model, SQLCipher, key storage, backup, and key-loss recovery need
a separately approved security design.

## Experience and verification

The Profile tab covers loading, first-launch empty, create, edit, validation,
saving, success, and safe error states. Existing design-system components are
reused. A reusable selection field supplies radio semantics and accessible errors.

Tests cover domain rules, use-case/repository interaction, conversion, transaction
context, migration presence, bound upserts, corrupt rows, UI states, and
accessibility. Completion requires every repository quality gate and the requested
manual checklist.

## Exclusions

Authentication, APIs, cloud synchronization, deletion, history, BMI, TDEE,
targets, analytics, AI, health integrations, notifications, export, localized
number parsing, application-level database encryption, and later capabilities are
excluded.

The repository owner approved the Stage 1 design and OS-sandbox security posture
on 2026-08-02.
