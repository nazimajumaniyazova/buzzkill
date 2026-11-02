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

**Option A: Canvas 2D behind a `Renderer` interface in `packages/engine`.** Decided by the owner on
2026-11-02, following the recommendation. The deciding arguments: the game is tens of sprites, far
below the point where `drawImage` becomes the bottleneck; a renderer with no dependency keeps the
whole bundle inside the stage 9 budget without a separate line for a library; and the engine keeps
ownership of time, assets and the render loop, which ADR-0009 needs anyway. PixiJS remains the
documented next step if the measurements of stage 9 say so.

History: this ADR was first accepted on 2026-11-02 with option B (PixiJS). The owner reconsidered the
same day, before any renderer code existed, and chose the recommended option; the original decision
text is in the git history of PR #52.

## Consequences

- `packages/engine/src/render/` holds the `Renderer` interface and its only implementation,
  `Canvas2DRenderer`. The interface is the seam: the simulation never calls `drawImage`, and a
  future WebGL renderer replaces one file.
- `packages/game` never touches the renderer. It compiles without the DOM lib and exposes the world
  state for drawing; `apps/web` wires the loop, the renderer and the canvas element together.
- Rendering reads the world after the last simulated tick and interpolates between the previous and
  the current tick for smooth motion at any refresh rate (ADR-0009). It never writes to the world,
  so determinism is unaffected.
- Sprite atlases are one PNG plus a typed JSON manifest of frames, produced by the stage 6 asset
  pipeline and loaded by the engine's loader with progress reporting. No third-party atlas format.
- Performance techniques belong to the renderer and are measured, not assumed: the parallax
  background is pre-rendered to an offscreen canvas once per level, draw calls are grouped by
  atlas, off-screen entities are culled, coordinates are rounded to integers before drawing, and
  the backing store follows `devicePixelRatio` up to a cap (issue #37).
- No new dependency: the shell stays within its 150 kB gzip budget and the game chunk contains only
  the engine and the simulation. The `OffscreenCanvas` experiment of ADR-0008 stays possible
  because Canvas 2D is available in workers.
- Browsers where `getContext('2d')` returns `null` get the existing "unsupported" message.
- Trigger to revisit: frame time above 8 ms on the reference desktop or below 60 FPS on the 4x
  throttled phone after pre-rendering, batching and culling are in place (stage 9 benchmarks). The
  superseding ADR evaluates option B behind the same `Renderer` interface.
