# ADR-0014: Game speed and the leaderboard

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 5, item 9 (#114): a game speed setting for accessibility. A slower game gives more
time to react to the insects. The acceptance criteria ask that the simulation stays deterministic
(the tick stays the same, the pacing changes) and that the effect on replays and the leaderboard
is decided.

What is already fixed:

- The simulation advances in fixed ticks with a constant `dt`, and the loop decides how many ticks
  fit between two frames from the frame times (ADR-0009). A replay is the input of each tick, so
  it does not record how fast the ticks went by.
- Stage 8 verifies a run on the server by simulating its replay again and comparing the score and
  the state hash. That check is the same at any pace.
- The server cannot know the pace a run was played at. The client reports it, and a client can
  also slow its own clock while it reports full speed. Re-simulation proves that the inputs reach
  the score, not how much time the player had for them.
- At a slower pace the same inputs are easier to give: there is more time per tick.

The speeds offered are 100 %, 75 % and 50 %. Nothing faster: the setting is for players who need
more time.

## Options

### A. Only runs at 100 % enter the global leaderboard

The pace travels with the run and with the record. Runs at 75 % and 50 % count as personal
records, marked with their speed, and stay out of the global top.

- Pros: the global competition stays at one pace. Slower play is fully playable and keeps its own
  records.
- Cons: a player who needs the slower pace has no place in the global top.

### B. One leaderboard, each entry marked with its speed

- Pros: the most inclusive; every run is on the same board.
- Cons: a slower run is easier, and only the mark tells it apart.

### C. A leaderboard per speed

- Pros: fair and inclusive.
- Cons: three tables to query, page and show in stage 8.

## Recommendation

A. It keeps the competition fair at one pace without taking anything from players who use the
slower one, and it costs one condition in stage 8.

## Decision

A, chosen by the owner on 2026-11-10.

## Consequences

- `GAME_SPEEDS` in `apps/web/src/state/settings/schema.ts` lists 1, 0.75 and 0.5, and `gameSpeed`
  is a setting under the schema of #110. Settings saved before it exist read as 1, without a new
  schema version.
- The pace belongs to the shell. `pacedHost` gives the engine's loop a frame clock that runs at the
  chosen speed, so the loop runs fewer ticks a second. The engine, the game, the ticks, `dt`, the
  replay and its hash do not change; a test runs the same ticks at 100 % and at 50 % and compares
  the results.
- `Run.speed` holds the pace from the settings when the run starts. A change in the settings
  applies to the next run.
- The settings screen says under the choice that only games at 100 % enter the leaderboard.
- Stage 8 sends the speed with the record, and the server keeps runs below 1 out of the global top
  and in the player's personal records. Whether the speed also enters the replay format is decided
  there, together with the backend (ADR-0007). Like any pace on a client, the speed a record
  reports cannot be proven; the global top rests on it as it rests on the player's own clock.
