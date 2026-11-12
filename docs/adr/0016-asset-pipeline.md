# ADR-0016: The asset pipeline

- **Status:** Accepted
- **Date:** 2026-11-12
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 6, item 3 (#133): a build step turns the asset sources into what the game loads. That
means sprites packed into atlases, images in WebP or AVIF, sounds in Opus or Ogg with a fallback,
and a typed manifest generated from the result.

ADR-0015 settled what the sources are:

- The art is SVG drawn as code in `@buzzkill/art`. Each sprite frame is drawn at its frame size in
  the game configuration, twice the world's pixels.
- The sounds are three Ogg Vorbis files from Kenney's CC0 packs, 7 to 28 kB each, in
  `apps/web/assets-src/sounds/`.

Facts that shape the choice (2026-11-12):

- **Target browsers.** The project sets none, so Vite's default applies: Chrome and Edge 107,
  Firefox 104, Safari 16. All of them decode WebP. AVIF needs Safari 16 on macOS 13 or later.
- **SVG in the browser.** Rasterizing SVG at load time is reported to work unevenly across
  browsers: Chrome's `createImageBitmap` does not decode an SVG blob, Safari before 26 had problems
  with SVG in `<img>`, and antialiasing differs between engines.
- **Ogg in Safari.** Safari decodes Ogg Opus and Vorbis only from 18.4, and WebKit bugs
  ([293310](https://bugs.webkit.org/show_bug.cgi?id=293310),
  [327697](https://bugs.webkit.org/show_bug.cgi?id=327697)) still report wrong results there.
  Safari 16 to 18.3 does not decode Ogg at all, so Safari needs a second file.
- **Tools.** No audio encoder is installed. Re-encoding the Kenney files from Vorbis to Opus would
  lose quality and save almost nothing at these sizes.
- **The simulation.** Art is drawing only. Frame sizes come from the game configuration, so the
  pipeline cannot change hitboxes or golden replays.

## Options

### Sprites

#### A. Rasterize at build time with resvg, encode WebP with sharp

A script renders every frame with resvg, packs the frames into atlases and encodes them with sharp.
The output and the manifest are committed.

- Pros: the pipeline the plan describes; the same pixels in every browser; images decode off the
  main thread with `createImageBitmap`, as the loader does today.
- Cons: two development dependencies with prebuilt native binaries; a few hundred kilobytes of
  images in the repository; a fixed resolution, twice the world's pixels.

#### B. Rasterize in the browser at load time

The game draws each SVG frame into an atlas canvas while it loads.

- Pros: no image files in the repository or on the network; sharp at any device pixel ratio;
  nothing to regenerate when the art changes.
- Cons: leaves the plan (no WebP or AVIF); the browser problems above; about 70 frames rasterized
  on the main thread during loading; no way for the agent to check Safari by hand.

#### C. Rasterize at build time with Playwright's Chromium

Playwright is already a development dependency of `@buzzkill/art`, for its review sheet.

- Pros: no new rasterizer.
- Cons: generating assets needs a browser download; Chromium encodes WebP but not AVIF, so sharp
  would still be needed for AVIF; Chromium's rendering differs between platforms and versions.

### Sounds

#### A. The Ogg files as downloaded, with WAV fallbacks

The game loads the Kenney files byte for byte. A script decodes them with a JavaScript Vorbis
decoder and writes a WAV of each, about 194 kB for all three. A browser downloads the WAV only when
the Ogg file does not decode.

- Pros: no external program; no second lossy encoding; the WAV is exact and decodes everywhere.
- Cons: Safari downloads more; Vorbis rather than the Opus the plan names.

#### B. Opus with MP3 fallbacks, encoded with ffmpeg

- Pros: the formats of the plan; about 25 kB of MP3 for all three.
- Cons: ffmpeg must be installed by hand; a second lossy encoding of compressed sound; the output
  depends on the ffmpeg build on the machine, so CI cannot reproduce it.

## Recommendation

Sprites A and sounds A.

## Decision

Sprites A and sounds A, chosen by the owner on 2026-11-12.

## Consequences

- **The engine.** A manifest entry can name a `fallbackUrl`. The loader tries it only when the first
  file downloads but does not decode. A failed download is reported at once, since the fallback
  comes from the same server.
- **The script.** A `pnpm assets` script renders the frames of `@buzzkill/art` with resvg at their
  own size, packs them into atlases and encodes WebP with sharp. It also writes a WAV next to each
  sound and generates a typed manifest with the frame rectangles of every atlas.
- **The drawing code.** The game draws from the frame rectangles of the generated manifest, which
  replaces the hand-written `GAME_ASSETS`. The 2023 files of unknown license leave the repository.
- **Images.** WebP only: every target browser decodes it, so no image needs a fallback. AVIF is not
  generated.
- **The CI check.** The manifest records a hash of each output's input: the SVG text, or the Ogg
  bytes, together with the pipeline's settings. CI recomputes these hashes without rasterizing and
  fails when the manifest is out of date. Comparing the encoded bytes instead would depend on the
  encoder build of each platform.
- **Dependencies.** `@resvg/resvg-js` (MPL-2.0), `sharp` (Apache-2.0, with libvips under
  LGPL-3.0) and `@wasm-audio-decoders/ogg-vorbis` (MIT) are development dependencies of the
  script. The game ships none of their code.
