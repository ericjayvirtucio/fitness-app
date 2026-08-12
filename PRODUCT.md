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

Each phase requires a reviewed specification. The roadmap expresses direction, not a promise of scope or schedule.

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
- **Portability:** users can export their information in documented formats, restore it offline into an installation that holds no information yet, replace everything stored on the device with a validated export in one all-or-nothing operation, and delete everything stored on the device in one deliberate, verified action.
- **Scalability:** architecture evolves from demonstrated constraints rather than premature distribution.
