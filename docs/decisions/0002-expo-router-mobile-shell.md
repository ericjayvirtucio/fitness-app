# ADR 0002: Expo Router mobile application shell

- Status: Accepted
- Date: 2026-08-01

## Context

The mobile application needs five primary destinations now and must accommodate nested feature screens and modal workflows later. Phase 0 deliberately deferred navigation and testing until meaningful mobile behavior existed.

## Decision

Use Expo Router for file-based routing. Compose a root stack around a five-destination bottom tab group, with Today as the initial route. Keep route modules thin and place reusable shell presentation and design-system primitives under `apps/mobile/src`.

Use semantic, typed tokens and React Native primitives for the initial design system. Follow the device color scheme without storing a manual preference. Use Expo Router's route error boundary contract for safe recovery.

Use Jest through `jest-expo` and React Native Testing Library for component behavior and accessibility-focused checks. Add tests to the repository's Turborepo and CI quality workflows.

## Consequences

- File paths form part of the navigation contract and must remain intentional.
- Future nested routes and root-level modals can be added without replacing the shell.
- Router and native navigation dependencies increase the mobile installation size but remain scoped to the executing application.
- System appearance works without storage; manual theme selection remains a future product decision.
- Component tests provide fast feedback but manual simulator and assistive-technology checks remain necessary.

## Alternatives considered

- Manual React Navigation composition was viable but would add routing boilerplate and diverge from the approved Expo direction.
- Separate feature implementations for empty tabs would create speculative modules with no domain behavior.
- A full UI or theming library was unnecessary for the small set of shell primitives.
- End-to-end device automation was deferred until critical user journeys justify its operational cost.
