# Architecture Decision Records

An ADR captures one significant decision: the context, the options that were considered with
their trade-offs, the decision and its consequences. ADRs are not edited after acceptance; a
changed mind gets a new ADR that supersedes the old one.

Numbers 0001–0009 are reserved by the project plan for the decisions it names; other decisions
continue from 0010.

| ADR                                        | Title                                     | Status   |
| ------------------------------------------ | ----------------------------------------- | -------- |
| [0001](0001-monorepo-tooling.md)           | Monorepo tooling                          | Accepted |
| [0002](0002-ui-shell.md)                   | UI shell framework                        | Accepted |
| [0010](0010-hosting-and-previews.md)       | Hosting, production and preview deploys   | Accepted |
| [0011](0011-changelog-and-releases.md)     | Changelog generation and release flow     | Accepted |
| [0003](0003-entity-model.md)               | Entity model of the simulation            | Accepted |
| [0004](0004-rendering.md)                  | Rendering technology                      | Accepted |
| [0009](0009-determinism-and-replays.md)    | Determinism and replays                   | Accepted |
| [0012](0012-benchmarks-in-ci.md)           | Benchmarks in CI                          | Accepted |
| [0005](0005-styling.md)                    | Styling approach for the design system    | Accepted |
| [0006](0006-state-management.md)           | State management of the application shell | Accepted |
| [0013](0013-internationalization.md)       | Internationalization of the shell         | Accepted |
| [0014](0014-game-speed-and-leaderboard.md) | Game speed and the leaderboard            | Accepted |
| [0015](0015-art-and-sound-sources.md)      | Where the game's art and sounds come from | Accepted |

## Template

```markdown
# ADR-NNNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-MMMM
- **Date:** YYYY-MM-DD
- **Deciders:** Nazima Jumaniyazova

## Context

## Options

### A. ...

- Pros:
- Cons:

## Recommendation

## Decision

## Consequences
```
