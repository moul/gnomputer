# ADR-002: EntityRef and lenses

## Context

Every object in Gnomputer needs a canonical, shareable identity and a predictable set of
views (spec §8-9).

## Decision

All objects are addressed by a `gno://<network>/<kind>/<path>` URI and modeled as an
`EntityRef` (`packages/entities`). Views are exposed as a fixed `LensId` enum
(experience, source, docs, state, history, actions, graph, raw, time); availability per
entity kind is a static matrix (`packages/lenses`), and unavailable lenses render an
explicit reason rather than an empty or broken view.

## Consequences

New entity kinds require updating both the URI parser's `PATH_KIND_MAP`
(`packages/entities/src/uri.ts`) and the lens availability matrix
(`packages/lenses/src/availability.ts`) in the same change — they're deliberately kept
in separate small files to make that easy to catch in review.
