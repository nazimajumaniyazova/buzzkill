# Architecture Decision Records

An ADR captures one significant decision: the context, the options that were considered with
their trade-offs, the decision and its consequences. ADRs are not edited after acceptance; a
changed mind gets a new ADR that supersedes the old one.

Numbers 0001–0009 are reserved by the project plan for the decisions it names; other decisions
continue from 0010.

| ADR                                    | Title                                   | Status   |
| -------------------------------------- | --------------------------------------- | -------- |
| [0001](0001-monorepo-tooling.md)       | Monorepo tooling                        | Accepted |
| [0002](0002-ui-shell.md)               | UI shell framework                      | Accepted |
| [0010](0010-hosting-and-previews.md)   | Hosting, production and preview deploys | Accepted |
| [0011](0011-changelog-and-releases.md) | Changelog generation and release flow   | Accepted |

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
