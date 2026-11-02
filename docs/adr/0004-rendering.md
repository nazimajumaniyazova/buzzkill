# ADR-0004: Rendering technology

- **Status:** Proposed (awaiting owner decision)
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
  community.
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

**Option A**, behind the `Renderer` interface. Measure first: the stage 9 budgets and the particle
load of stage 7 decide whether a GPU renderer is ever needed. The interface keeps that door open
without paying for it now, and the ADR-0008 experiment (worker + `OffscreenCanvas`) applies to
Canvas 2D unchanged.

Trigger to revisit: frame time above 8 ms on the reference desktop, or below 60 FPS on the throttled
phone, after offscreen pre-rendering, batching by atlas and culling are in place.

## Decision

_Pending owner decision._

## Consequences

- `packages/engine/src/render/` holds the `Renderer` interface and the Canvas 2D implementation;
  nothing in `packages/game` imports the implementation.
- Sprites are addressed by atlas and frame index; the asset loader produces atlases (stage 6
  pipeline).
- `devicePixelRatio` and resizing are handled in the renderer, not in entities.
- Benchmarks measure render cost separately from simulation cost so a regression points at one
  side.
