# Specification 0001: Mobile application shell

- Status: Approved
- Date: 2026-08-01

## Objective

Establish a production-quality Expo mobile shell for iOS that is structurally ready for Android. The shell provides scalable navigation, a minimal design system, system light and dark appearance, accessible empty destinations, safe route recovery, and automated tests without introducing fitness business behavior.

## Scope

The application exposes five bottom-tab destinations: Today, Nutrition, Workout, Progress, and Profile. Today is the initial route. Each destination clearly states that its module will arrive in a later phase and contains no fake metrics or user records.

Expo Router owns route composition. Route modules remain thin; reusable presentation belongs under `src`. The root stack must allow future nested destinations and modal routes without requiring a navigation rewrite.

The design-system scope is limited to semantic color, spacing, typography, radius, and elevation tokens plus the screen, text, button, surface, and empty-state primitives used by this shell. Appearance follows the device setting. Theme persistence is excluded.

## Quality requirements

- The shell renders without a network request.
- Important navigation and controls have accessible names and roles.
- Text supports system scaling where practical, controls have suitable touch targets, and meaning does not depend on color.
- Unexpected route rendering errors show an accessible, non-technical fallback with retry behavior.
- Tests verify the initial destination, primary destination configuration, empty-state presentation, base button behavior, and error recovery.
- Formatting, linting, strict type checking, tests, Expo dependency validation, and application export must pass without warnings.

## Explicit exclusions

This phase contains no authentication, persistence, synchronization, API integration, analytics, AI, health-platform integration, notifications, calculations, fitness records, logging forms, or global Add behavior. It does not establish production identifiers, signing, store deployment, or commercial branding.

## Architecture and dependencies

The executing mobile workspace owns Expo Router, its Expo-compatible navigation and platform dependencies, and the mobile test dependencies. No shared package or state-management abstraction is created. See [ADR 0002](../docs/decisions/0002-expo-router-mobile-shell.md).

## Acceptance and verification

Implementation begins only after design approval. Completion requires automated repository checks, a successful Expo export, senior self-review, current documentation, and manual iOS simulator guidance. The repository owner approved the Stage 1 design on 2026-08-01.
