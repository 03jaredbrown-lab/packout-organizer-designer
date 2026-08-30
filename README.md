# PACKOUT Organizer Designer

A visual web app for designing custom tool-organizer **inserts** that fit inside
Milwaukee **PACKOUT** storage containers, and exporting them as 3D-printable
**STL** files.

Runs entirely in the browser. No backend, no accounts, nothing uploaded.

## What it does

1. **Pick a container.** Its internal cavity defines the design area. If the
   cavity isn't in the library yet, type in the measurements — they're saved
   locally.
2. **Build a tool list.** Add from the starter library or measure your own
   (name + length/width/height; the app stores millimetres, displays inches or
   mm).
3. **Arrange.** Drag tools around a true-scale top-down canvas, rotate in 90°
   steps, snap to a grid.
4. **Verify.** Live checks for overlaps, out-of-bounds pockets, thin walls, and
   an insert too tall for the closed lid.
5. **Tune pockets.** Per pocket: clearance, depth, finger-scoop toggle.
6. **Export.** Download a binary STL for printing and a `.packout.json` project
   file you can reload later.

## Status — M1–M3 working, M4 partial

| Area | State |
|------|-------|
| Data model + schema (zod) | done |
| Container / tool libraries | seeded from public Milwaukee data (see below) |
| 2D arrangement canvas (SVG, drag + rotate + snap) | done |
| Fit validation (bounds, overlap, min-wall, height, depth) | done, unit-tested |
| Project save / load / autosave | done |
| STL export | working via a rectilinear grid engine — **plain rectangular pockets only** |
| 3D preview | not yet (planned M4) |
| Finger-scoop geometry, free-angle pockets in STL | not yet |

Test-print anything you export and expect to adjust clearances before it's dialed in.

## Tool & container dimension data

Milwaukee **does** publish data on `milwaukeetool.com`, but not enough to skip
measuring:

- **Containers** — product pages list exterior *and* interior W×D×H for some
  models. Seeded: Low-Profile Compact Organizer (48-22-8436) and the 10-comp
  Organizer (48-22-8430). Everything else in `data/containers.json` has a null
  cavity and a note. Published interior figures round hard and ignore ribs and
  the lid lip, so every container stays `verified: false` until confirmed with
  calipers.
- **Tools** — product pages publish only overall **Length** and bare **weight**,
  never a full bounding box. `data/tools.starter.json` carries the published
  lengths for a couple of M18 tools; width and height are null pending
  measurement. In practice you measure the tools you own — the app's tool form
  is built for exactly that.

Nothing is scraped at runtime; the JSON libraries are static and in git.

## Hosting

Primary: **GitHub Pages**, built and deployed by `.github/workflows/deploy.yml`
on every push to `main`. Because the whole app is a pure function of
`(container, tools, layout) → STL`, a static host is the right fit and both a
Mac and a PC just hit the same URL.

Also supported: **Replit** — `.replit` is configured, so *Import from GitHub*
gives a live dev URL with no setup, and Replit's static *Deploy* serves the
build. Use it if you want in-browser editing or a share link without touching
GitHub Actions. Tradeoff: Replit adds a moving part and (on the free tier) the
dev URL sleeps; Pages is zero-maintenance but build-then-deploy only.

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5000
npm test           # vitest — geometry + validation
npm run build      # tsc -b && vite build  ->  dist/
```

See [`docs/PLAN.md`](docs/PLAN.md) for the roadmap and
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) for the schema.
