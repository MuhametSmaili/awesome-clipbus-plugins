# Vibe

**Emotional fallback animation for Clipbus** — when no other plugin can render a copied text, Vibe turns it into a premium Three.js particle animation: chaos → order.

## How it works

### Fallback mechanism

Vibe's detector checks the V2 attachment references in `input.item.attachments`. If another plugin has already attached a result (`own: false`), Vibe yields without writing. Otherwise, it attaches an animation payload to non-empty text. Its own references (`own: true`) allow a full write on recopy, so repeating a copy keeps the animation available.

The check uses the detector's item snapshot. Attachments added by another detector afterward are considered on the next detection; there is no runtime renderer visibility hook in protocol V2.

### Three switchable animations

Vibe ships with three animations. A native button bar rendered by Clipbus below the card shows one button per animation **in the configured list**, in order. Clicking any button switches to that animation; clicking the current one replays it. The **first** animation in the list is shown on load. Which animations appear and their order is configurable via Settings (see below); unset shows all three in default order.

#### Particle Core (`particle-core`) — 4.8 s

| Phase | Time | Description |
|---|---|---|
| Intro | 0 – 0.18s | Particles materialise at the text glyph positions (fade-in) |
| Burst | 0.18 – 0.35s | Compressed-energy release outward into 3-D space |
| Chaos | 0.35 – 1.6s | Simplex-noise flow field — organic, turbulent drift |
| Attraction | 1.6 – 3.1s | Spring force pulls particles toward a Fibonacci sphere |
| Reassembly | 3.1 – 4.1s | Particles converge precisely onto the sphere; bloom pulse fires |
| Settle | 4.1s+ | Fibonacci sphere rotates slowly; opacity breathes — calm endpoint |

Palette: cyan `#5CE1FF`, purple `#9A6BFF`, soft white `#EAF6FF`.

#### Text Reveal (`text-reveal`) — 4.6 s

| Phase | Time | Description |
|---|---|---|
| Text In | 0 – 0.6s | Particles settle into readable text glyphs (≥ 0.6 s legible) |
| Scan | 0.6 – 1.2s | A light band sweeps left-to-right, highlighting the glyphs |
| Deconstruct | 1.2 – 1.8s | Edge particles begin to drift; silhouette stays recognisable |
| Burst | 1.8 – 2.4s | Staggered release — particles explode outward from the text shape |
| Recall | 2.4 – 3.5s | Spring force draws particles toward a polyhedral core |
| Form / Settle | 3.5s+ | Particles lock onto an icosahedron; core rotates slowly |

Palette: cyan `#7EE7FF`, purple `#A78BFA`, soft white `#FFFFEF`. The reassembly target is an icosahedron (detail-4), giving a faceted "data crystal" look distinct from Particle Core's smooth sphere.

> **Text fit fix**: glyph positions are now computed with `computeGlyphFit`, scaling the text to ~46 % of the card height. On real small cards the text is now clearly readable instead of appearing as a tiny cluster.

#### Text Loop (`text-loop`) — 10 s seamless loop

| Phase | Time | Description |
|---|---|---|
| P1 Text Present | 0 – 1.0s | Text glyphs hold steady; opacity fades in then gently breathes |
| P2 Particlise | 1.0 – 2.0s | Staggered noise jitter breaks the glyph outlines (silhouette preserved) |
| P3 Burst | 2.0 – 3.0s | Particles scatter from text toward their cloud positions |
| P4 Drift Cloud | 3.0 – 5.0s | Noise-driven energy cloud; drift amplitude is zero at both ends (seamless join) |
| P5 Recall | 5.0 – 6.5s | Swirling vortex draws particles onto a Fibonacci sphere; swirl fades out on arrival |
| P6 Stable Sphere | 6.5 – 8.0s | Sphere pulses gently; no accumulated rotation (loop-safe) |
| P7 Deconstruct | 8.0 – 9.0s | Sphere dissolves back to cloud positions |
| P8 Reassemble | 9.0 – 10.0s | Particles flow along the original burst paths in reverse, reforming exact text glyphs — loop restarts |

Seamless guarantee: P8 ends with every particle at `textPos` (= P1 start); P4 drift envelope `sin(π·lp)` is zero at both ends; P5 swirl `θ = swirl·(1−lp)·3` is zero at `lp=1`; afterimage damp is constant throughout to prevent a seam flash.

Palette: cyan `#7EE7FF`, purple `#A78BFA`, white `#FFFFFF`.

### Switching animations

Switching uses `ctx.renderer.update({ buttons })` and `ctx.renderer.onButton(event => ...)`, where `event.id` selects the animation. On load, Vibe resolves the list from settings and publishes one **enabled** native button per animation; the first is shown. Clicking an animation switches to it; clicking the current one replays it. Subscriptions and animation resources are released when the card unmounts.

### Settings

Vibe reads one read-only setting, **`plugin.vibe.animations`** — the list of animation ids to show, in order. The **first** entry is shown on load; each listed animation gets one button.

| Value | Effect |
|---|---|
| JSON array of ids, e.g. `["text-loop","particle-core"]` | Shows exactly those animations in that order; first shown on load |
| unset / empty / no valid ids | Shows all animations in default order (`particle-core`, `text-reveal`, `text-loop`); first shown on load |

Valid ids: `particle-core`, `text-reveal`, `text-loop`. Unknown ids are ignored, duplicates collapsed. A comma/space-separated string (e.g. `"text-loop, particle-core"`) is also accepted.

Plugins read settings with `ctx.settings.get<{ animations?: unknown }>()`. It returns `{ values }`, with the plugin prefix removed: the host key `plugin.vibe.animations` becomes `values.animations`. Settings are read-only. To configure the host's shared JSON store, edit the file and reload the plugin:

```
~/Library/Application Support/Clipbus/ExternalSettings/settings.json   (…/ClipbusDebug/… for debug build)
```

```json
{ "plugin.vibe.animations": ["text-loop", "particle-core"] }
```

Then reload Vibe (Settings → Plugins → Developer Plugins → Reload) or restart Clipbus. The in-card switch is per-session only and is not written back.

### Adding more animations

The registry (`src/features/vibe-fallback/animations/index.ts`) accepts any object implementing `VibeAnimation`. Append it to the array — when `plugin.vibe.animations` is unset the button bar lists all registered animations automatically; otherwise only the ids in that setting are shown.

## Notes

- The four preview scenarios preserve the plain-text and short-word samples and demonstrate ordered and single-animation settings. Runtime tests cover foreign attachment references and own-only recopy; host detection ordering still requires a real Clipbus environment.
- The card background is intentionally dark (deep-space radial gradient). This is a deliberate design choice for the animation, not a theming error.
- The host stores attachments locally; Vibe declares its attachment type in `writes.attachmentTypes`.
