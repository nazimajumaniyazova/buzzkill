# ADR-0004: Rendering technology

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** Nazima Jumaniyazova

## Context

Buzzkill is a 2D side-scroller: a parallax background, a hero, tens of enemies and projectiles,
explosion sprite sheets, and from stage 7 a particle system, screen shake and hit flashes. The
budgets of stage 9 are 60 FPS on a mid-range Android phone with 4x CPU throttling, update plus
render under 8 ms per frame on desktop, and a shell bundle of at most 150 kB gzip with the game as a
separate chunk. Replays (ADR-0009) require that rendering never influences the simulation.

## Options

### A. Canvas 2D with a small renderer in `packages/engine`

A `Renderer` interface (`beginFrame`, `drawSprite(atlas, frame, x, y, ...)`, `drawText`,
`endFrame`) implemented on `CanvasRenderingContext2D`, with sprite atlases, culling of off-screen
entities, integer coordinates and an offscreen pre-rendered background.

- Pros: no dependency and no bundle cost; every browser and `OffscreenCanvas` (ADR-0008
  experiment) support it; the whole pipeline is readable in an afternoon; the owner already knows
  it from the 2023 code.
- Cons: `drawImage` is CPU-bound: thousands of particles or large overdraw can miss the frame
  budget; batching, culling and atlas management are ours to write and measure.

### B. PixiJS

A scene graph on WebGL/WebGPU with automatic sprite batching, particle containers, filters and
culling.

- Pros: proven performance headroom far beyond this game; particles and filters for free; large
  community; a renderer that most hiring teams recognize.
- Cons: 100–200 kB gzip even with modular imports, a large part of the budget for a game this
  size; a second object model (display objects) next to the ECS world that must be kept in sync
  every frame; the library owns texture loading and the render loop, which fights the engine's own
  asset loader and fixed-step loop; a dependency to track for an engine of a few hundred lines.

### C. Hand-written WebGL (or WebGPU) sprite renderer

Instanced quads, one draw call per atlas, GPU-side transforms.

- Pros: best possible throughput; an impressive piece of portfolio work on its own.
- Cons: weeks of work (shaders, batching, text, context loss, fallbacks) before the first enemy
  moves again; WebGPU is not universal on mobile; the value is unproven for tens of sprites.

## Recommendation

Option A behind the `Renderer` interface, measuring first, with a trigger to revisit (frame time
above 8 ms on the reference desktop or below 60 FPS on the throttled phone after offscreen
pre-rendering, batching and culling).

## Decision

**Option B: PixiJS.** Decided by the owner on 2026-11-02, against the recommendation above.
Owner's rationale: _to be written by the owner in this section before the ADR is merged._

## Consequences

- `pixi.js` (v8) is a dependency of `packages/engine` only. `packages/game` and `apps/web` never
  import it; dependency-cruiser gets a rule for that, and the simulation keeps compiling without
  the DOM lib.
- The engine still exposes a `Renderer` interface. The PixiJS implementation keeps one pooled
  `Sprite` per entity id and copies position, frame and visibility from the world after each
  simulated tick, with interpolation. The ECS world stays the source of truth; display objects are
  a render cache that can be rebuilt from it.
- PixiJS owns the WebGL/WebGPU context, `resolution` (device pixel ratio) and resizing. The
  engine's fixed-step loop (ADR-0009) owns time: the PixiJS `Ticker` is not used as a clock.
- Assets: PixiJS `Assets` and its `Spritesheet` format are the atlas format; the stage 6 pipeline
  emits it, and the engine's loader wraps it with progress reporting and typed manifests.
- Bundle: PixiJS lives in the lazily loaded game chunk, not in the shell. The stage 9 budget gets a
  separate line for the game chunk, measured when the renderer exists; modular imports are
  mandatory.
- Determinism (ADR-0009) is unaffected because the simulation never reads anything from PixiJS.
- PixiJS v8 has no Canvas 2D fallback: browsers without WebGL get the existing "unsupported"
  message instead of the game.
- Trigger to revisit: if the game chunk exceeds its stage 9 budget or the sync between world and
  display objects becomes the hot spot, option A is the fallback and the `Renderer` interface is
  the seam.
