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

Later (not v1): hosted shared libraries, optional accounts, a print-service
hand-off.

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

- **M0 — Scaffold** *(in progress)*: repo, plan, data schema, GitHub remote.
- **M1 — Container to scale**: container picker; 2D canvas renders the selected
  container cavity at true scale with pan/zoom and a mm grid.
- **M2 — Tools + arrangement**: tool palette; manual tool-entry form; place /
  drag / rotate tools; project save + load as JSON.
- **M3 — Validation**: overlap, bounds, min-wall, height rules with visible
  warnings and a verify checklist.
- **M4 — Geometry engine**: generate the insert mesh from a layout; 3D preview.
- **M5 — STL export**: download STL; print-orientation and global tolerance
  settings; do a real test-print round trip and adjust default clearances.
- **M6 — Libraries**: flesh out and *verify* the container library; build the
  curated starter tool library from public spec sheets (with citations).
- **M7 — Polish**: label embossing, finger-scoops presets, multi-zone inserts,
  stacked layers, bed-size tiling, shareable library files.

## Open decisions (need user input before M6, some before M1)

### 1. Tool-dimension sourcing  *(blocking the tool library)*

Not scraping milwaukeetool.com — the sibling Home Depot project just hit heavy
Akamai bot-protection doing exactly that, so it's fragile and not worth building
on. Proposed instead:

- **Primary**: the user measures and enters the tools they actually own, through
  a guided form; entries persist and are exportable.
- **Bootstrap**: a *small* curated starter set built from publicly published
  Milwaukee spec sheets / manuals (PDF), each entry cited and flagged
  verified / unverified.
- **Sharing**: a documented CSV/JSON library format so users can trade libraries.

### 2. First container(s) to support

Which PACKOUT container(s) to target for M1–M5. Candidates the maker community
builds inserts for most: Low-Profile Organizer, Deep Organizer, the 2/3-drawer
tool box drawers, and the Large/Medium tool box main cavity. Every internal
dimension used has to be confirmed by measurement before it drives an export —
`data/containers.json` currently holds placeholders only.

### 3. Assumed unless told otherwise

- Units: mm internally, with an inch display toggle in the UI.
- Target print bed: 256 mm (common for Bambu / large Prusa); tiling handles
  bigger inserts.
- v1 is local-only, no accounts.
