# PACKOUT Organizer Designer — Plan

## Goal

A browser app that lets you visually lay out the tools you own inside a Milwaukee
PACKOUT container, verify the arrangement fits, and export a 3D-printable STL of
a custom insert with a pocket for each tool.

Think "the gridfinity-for-PACKOUT customizers, but driven by your actual tool
dimensions and a real fit check."

## Core user flow

1. **Choose container** — select a PACKOUT container from the library. Its
   internal usable cavity (X × Y × Z, in mm) becomes the design area.
2. **Build a tool palette** — add tools from the starter library, or enter one by
   hand: name, brand, category, bounding box L × W × H, optional traced 2D
   outline for a tighter pocket, pocket style (prism / outline / cylinder).
3. **Arrange** — top-down 2D canvas at true scale. Drag, rotate (90° snap + free),
   snap-to-grid, snap-to-neighbor. Live checks: overlap, out-of-bounds,
   min wall between pockets, min wall to container edge.
4. **Tune pockets** — per pocket: clearance (tolerance) in mm, pocket depth,
   finger-scoop (semicircular cut for lifting the tool out), optional label tab.
5. **3D preview** — live mesh of the generated insert (react-three-fiber).
6. **Verify** — a checklist panel: all pockets in bounds, no overlaps, walls
   >= min, total insert height <= container Z (with lid clearance), estimated
   print time / filament (rough).
7. **Export** — STL for printing + project `.json` (schema-versioned) to reopen.
   Optional: split into tiled parts if the insert exceeds a target bed size.

## Architecture

Single-page app, **no backend for v1**. Everything runs client-side; projects
are saved as downloaded `.json` and re-loaded by the user. Tool/container
libraries ship as static JSON in the repo, with user additions kept in
`localStorage` and exportable as CSV/JSON.

The model, layout, and geometry code is a **portable core** with no browser/Node
API dependencies, re-exported from `src/core/index.ts`. `exportInsertSTL()`
already returns raw bytes, so the same code can back a hosted export API or a
mobile client without a rewrite. See [`ARCHITECTURE.md`](ARCHITECTURE.md).

Later (not v1): hosted shared libraries, optional accounts, a print-service
hand-off, a hosted STL/export API, and native iOS/Android clients — see
**Beyond v1** below.

### Layers

| Layer | Responsibility |
|-------|----------------|
| **Data** | `data/containers.json`, `data/tools.*.json`, project-file schema |
| **Layout engine** | scene of placed tools in mm; pure validation functions (overlap, bounds, wall thickness, height) |
| **Geometry engine** | layout -> parametric insert solid -> triangulated mesh -> STL. Hidden behind one interface so the CSG backend can be swapped. |
| **UI** | React. 2D canvas for arrangement, 3D canvas for preview, forms for tool entry + pocket params. |

### Geometry approach

```
insert = slab( footprint = containerInternalXY - edgeClearance,
               thickness = chosen base + max pocket depth )
for each placed tool:
    pocket = extrude( toolOutline OR (bbox + clearance) , depth )
    pocket = translate/rotate pocket to layout position
    insert = insert - pocket
    if fingerScoop: insert = insert - scoopCylinder
```

CSG backend candidates:

- **@jscad/modeling** — pure JS, parametric, STL export, built for 3D printing.
  Proposed default: fast to iterate, no wasm.
- **manifold-3d** — wasm, guarantees watertight/manifold boolean results. Best
  fallback if JSCAD booleans produce non-manifold meshes on complex layouts.
- **openscad-wasm** — full OpenSCAD in the browser. Most capable and familiar to
  the maker community, but heavy payload and slower regen. Keep as an option for
  "power" export, not the interactive loop.

Decision: build behind `GeometryEngine` interface, start with @jscad/modeling,
keep manifold-3d as the escape hatch.

## Milestones

- **M0 — Scaffold** ✅: repo, plan, data schema.
- **M1 — Container to scale** ✅: container picker; SVG canvas renders the cavity
  at true scale with a mm grid. (Pan/zoom not yet — the cavity fits the viewport
  for now.)
- **M2 — Tools + arrangement** ✅: starter library + measure-a-tool form; place /
  drag / rotate (90°) / snap; project save, load, and localStorage autosave.
- **M3 — Validation** ✅: overlap, bounds, min-wall (neighbour + edge), height,
  pocket-depth rules; verify panel with error/warning counts; unit tests.
- **M4 — Geometry engine** 🚧: `GeometryEngine` interface + `SlabGeometryEngine`
  (rectilinear grid decomposition, no CSG dep) generating a real insert mesh.
  *Remaining*: 3D preview (react-three-fiber), finger-scoop cuts, true
  rotated-pocket geometry, CSG backend swap.
- **M5 — STL export** 🚧: binary STL download works, plus a project `.json`.
  *Remaining*: print-orientation options, global tolerance sweep, real
  test-print round trip to set default clearances.
- **M6 — Libraries**: verify container cavities by measurement; expand the
  starter tool set; CSV import/export for shareable libraries.
- **M7 — Polish**: label embossing, finger-scoop presets, multi-zone inserts,
  stacked layers, bed-size tiling.

## Beyond v1 — hosted export + mobile (future scope, not scheduled)

The web app stays fully client-side. These are additive:

- **Extract `packages/core`** — turn `src/model` + `src/layout` + `src/geometry`
  (already dependency-free of any platform) into a standalone package so web,
  backend, and mobile share one implementation of validation + geometry.
- **Hosted STL/export API** — a small stateless service wrapping the core:
  `POST /v1/stl` (project JSON → binary STL) and `POST /v1/stl/email`
  (project + address → STL generated and emailed as an attachment). Pure
  function of the request body, so responses cache on a project hash. This is
  where a backend finally enters the picture — and the point at which Replit or
  a serverless host earns its place.
- **iOS + Android apps** — native / React Native UI for the arrange-and-verify
  loop, calling the hosted API for STL generation and the email hand-off rather
  than porting the geometry code to Swift/Kotlin. Emailing the finished `.stl`
  from the app is the headline mobile feature.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the boundary this depends on and the
rule for keeping it clean.

## Decisions (resolved 2026-08-29)

### 1. Tool-dimension sourcing — RESOLVED

Checked what `milwaukeetool.com` actually publishes:

- **Container product pages** expose exterior *and* interior W×D×H for some
  models (confirmed for 48-22-8436 and 48-22-8430). The 2023 PACKOUT Dimension
  Catalog PDF exists but its figures are vector callouts that don't extract
  cleanly, and several product pages render specs via JS so a plain fetch misses
  them.
- **Tool product pages** publish only overall **Length** and bare **weight** —
  never a full bounding box.

So the approach the sibling session proposed stands, now backed by evidence:

- **Primary**: user measures and enters the tools they own via the tool form
  (`ToolForm` in `src/ui/panels.tsx`). Entries persist in `localStorage` and are
  embedded in the saved project file.
- **Bootstrap**: `data/tools.starter.json` — small, each field carrying its
  source; Milwaukee-published lengths included, width/height left null.
- **Containers**: `data/containers.json` seeded with the two spec-confirmed
  cavities; the rest null with notes. All stay `verified: false` until measured.
- **Sharing**: project files are self-contained JSON; a CSV tool-library format
  is still a later task (M6).

### 2. First container(s) to support — RESOLVED

Support the whole organizer family in the picker, but the two with real cavity
data — **Low-Profile Compact Organizer (48-22-8436)** and **Organizer
(48-22-8430)** — are the ones usable end-to-end today. Others need a measurement
pass (or the user typing their cavity into the UI, which is wired up).

### 3. Hosting — RESOLVED: GitHub Pages primary, Replit supported

v1 has no backend (`(container, tools, layout) → STL` is pure), so a static host
is the correct fit. **GitHub Pages** via `.github/workflows/deploy.yml` is the
primary target: push to `main`, both machines hit one URL, zero maintenance.
**Replit** is kept as an option — `.replit` is configured for *Import from
GitHub* (instant dev URL) and static *Deploy*. Replit wins for in-browser
editing / quick share links; Pages wins for hands-off CI deploys.

### 4. Assumed unless told otherwise

- Units: mm internally, inch/mm display toggle in the UI (done).
- Target print bed: 256 mm; tiling handles bigger inserts (M7).
- v1 is local-only, no accounts.
- STL v1: rectilinear grid engine, pockets are plain recesses. CSG
  (`@jscad/modeling` / `manifold-3d`) behind the `GeometryEngine` interface is a
  later swap.
