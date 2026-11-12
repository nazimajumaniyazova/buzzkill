# ADR-0017: Levels and the end of a run

- **Status:** Accepted
- **Date:** 2026-11-12
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 7, item 1 (#150): levels as data, with waves of enemies, their speed and pace, a change
of day and night, and a screen between levels.

Before levels, a run worked like this:

- **One endless level.** An enemy every 1.7 s, then every 0.4 s from the twentieth second on, as
  in 2023.
- **The end.** The run was won above 100 points and lost with the last life.
- **Day or night.** The player picks it before the run, in the hero select. The replay stores the
  choice as `mode`, and the city and the page's theme follow it.
- **Replays.** `RunResult` already has a `level` field, always 1, so the server schema of stage 8
  could stay stable.

Two questions had no answer in the plan:

- how the change of day and night in the level data fits the player's choice of one;
- how a run ends once there are levels.

The second one also shapes the boss (#152), the daily challenge (#165) and the leaderboard of
stage 8.

## Options

### Day and night

#### A. The player picks the first level's time; the level data says when it changes

- Pros: the hero select and the replay format stay as they are; the player keeps the choice;
  levels still bring the change.
- Cons: the same level can be played by day or by night, so its waves name the enemies by their
  place in the time's set rather than by kind.

#### B. Only the levels decide

Day levels first, then night ones, like the story of one day.

- Pros: each level is one fixed experience.
- Cons: the hero select loses its choice; the night enemies are seen only by players who get far.

#### C. The time never changes

- Pros: the simplest.
- Cons: drops the change of day and night that the plan asks for.

### The end of a run

#### A. A campaign of six levels

Clearing the sixth wins the run.

- Pros: a run has a finish; a boss can close the third and the sixth level (#152); the daily
  challenge and the server's re-simulation get a bounded length.
- Cons: a good player's run ends at a fixed point.

#### B. Endless

The levels repeat faster until the last life is lost.

- Pros: a classic score chase.
- Cons: no finish; the server re-simulates longer replays.

#### C. A campaign, then endless waves

- Pros: both.
- Cons: the most work; it can come later as its own issue.

## Recommendation

A for day and night, A for the end of a run.

## Decision

A and A, chosen by the owner on 2026-11-12.

## Consequences

- **The data.** `LEVELS` in `packages/game/src/config/levels.ts`: six levels, each with the
  following.
  - Its waves: how many enemies, how many ticks apart, and optional weights over the time's set
    of three.
  - The calm before each wave, a speed factor for its enemies, and whether the time of day
    changes after it.
- **The data as it stands.**
  - The time changes after the third level.
  - The pace grows from an enemy every 1.5 s to one every 0.43 s, close to the 2023 peak. The
    speed grows by a quarter.
  - The first wave of the first level leaves the third enemy of each set out.
- **Ending a level.** A level ends when all its waves are sent and no enemy is left. The run is
  then `levelCleared` until the next tick, which starts the next level, or `won` after the sixth.
  `RULES.winningScore` and the old spawn ramp are gone; lives still end a run as `lost`.
- **Events.** The simulation reports `levelCleared` and `levelStarted`, the latter with the time
  of day.
- **The run's state.** The state hash covers the level, the wave and the time of day.
  `RunResult.level` is the level reached.
- **Replays.**
  - The screen between levels holds the game like a pause: those ticks are never simulated, so
    the replay and the server's re-simulation do not depend on how long the player waits.
  - The golden replays change once, with this decision.
- **The shell.** It shows the screen between levels, the level in the HUD and the theme of the
  current time. That is the second part of #150.
