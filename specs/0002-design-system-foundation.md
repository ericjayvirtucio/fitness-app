# Specification 0002: Design system foundation

- Status: Approved
- Date: 2026-08-01

## Objective

Establish the reusable visual and interaction foundation for future mobile
features. The system must feel calm, professional, modern, readable, and
accessible without introducing fitness behavior or speculative infrastructure.

## Scope

The mobile application owns a typed, semantic design system under
`apps/mobile/src/design-system`. It includes light and dark system themes;
color, typography, spacing, radius, elevation, opacity, border, icon, motion,
and touch-target tokens; and foundational text, icon, button, text-field, card,
surface, divider, loading, screen, empty-state, and section-header components.

Existing shell, navigation recovery, and not-found presentation migrate to the
public design-system boundary. Components support native properties where doing
so preserves their semantic contract. Feature code must not depend on theme or
component implementation files.

## Architecture and dependencies

The design system remains app-local because the mobile application is its only
UI consumer. Runtime appearance follows `useColorScheme`; a pure theme selector
makes light, dark, and unspecified system values deterministic and testable. A
custom theme provider, state store, persisted override, and shared workspace
package are excluded.

Ionicons through the existing Expo vector-icons dependency is the sole icon
set. React Native and existing Expo-compatible dependencies provide all other
behavior, so this specification adds no package dependency.

## Accessibility and performance requirements

- Text permits Dynamic Type and meaningful layouts remain usable at large text.
- Interactive components expose correct roles, names, disabled/busy state, and
  at least a 44-point touch target.
- Validation and loading meaning is available without relying on color alone.
- Input labels, helper text, and error text have a programmatic relationship.
- System reduced-motion preferences are respected by avoiding decorative
  animation in this foundation.
- Components use direct theme selection rather than an additional provider and
  avoid hidden state or unnecessary render indirection.

## Testing and verification

Behavioral tests cover theme selection, token contracts, button variants and
states, field states and accessibility, card interaction, screen modes, icons,
and the shared empty state. Existing shell and recovery tests must continue to
pass.

Completion requires repository formatting, linting, strict type checking,
tests, application export, and Expo dependency validation without warnings.
Manual follow-up checks cover light and dark appearance, Dynamic Type,
VoiceOver, TalkBack, keyboard behavior, and platform shadow rendering.

## Explicit exclusions

This sprint adds no nutrition, workout, hydration, goal, analytics, history,
authentication, persistence, synchronization, API, validation rule, form flow,
notification system, chart, report, custom font, or decorative animation. It
does not create badges, chips, banners, skeleton components, a component
showcase application, or a cross-workspace UI package without a demonstrated
consumer.

## Alternatives and trade-offs

A third-party UI framework was rejected because the required primitive set does
not justify its dependency, bundle, theming, and migration cost. A custom theme
provider was rejected because system appearance is the only approved runtime
mode. Generic style-prop primitives were rejected because semantic components
better constrain the visual language.

Platform elevation tokens normalize intent rather than promise pixel-identical
shadows. Component tests provide fast semantic coverage but do not replace
assistive-technology and simulator verification.

## Migration and rollback

The existing shell-sized primitives evolve in place, retaining practical
defaults while consumers move to the public design-system exports. There is no
stored data or network migration. The change can be rolled back as one mobile
presentation change without affecting business data or external services.

The repository owner approved the Stage 1 design on 2026-08-01.
