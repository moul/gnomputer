# ADR-003: Trails as the core primitive

## Context

Spec §4 identifies the Trail — a persistent, inspectable path through the shared
computer — as Gnomputer's distinctive product primitive, not an afterthought feature.

## Decision

Trail recording starts automatically on first navigation (no explicit "start" action
required from the user) and every subsequent entity view appends a step, persisted to
Dexie via `packages/trails`. Slice 1 ships recording, renaming, and reload-restoration
only — manual annotation, sharing, and Run-program conversion are later phases (spec §34
Phase 2+, Phase 5).

## Consequences

Every route component that renders an entity must call `useTrailRecorder`
(`apps/web/src/use-trail-recorder.ts`) — this is a convention, not yet mechanically
enforced. A future slice should consider an ESLint rule or a wrapping HOC once more than
a handful of route components exist.
