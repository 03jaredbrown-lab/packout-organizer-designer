# Architecture

## The portability boundary

The app is deliberately split into a **portable core** and thin **platform
layers**. This is the seam that lets a future hosted API and native mobile
clients reuse the hard parts instead of reimplementing them.

```
                    ┌───────────────────────────────────────────┐
                    │  portable core  (src/core → re-exports)    │
                    │                                           │
   src/model    ───▶│  types + zod schemas + project (de)ser    │
   src/layout   ───▶│  pocket resolution + validateLayout()     │
   src/geometry ───▶│  GeometryEngine + SlabGeometryEngine +    │
                    │  binary-STL writer + exportInsertSTL()    │
                    │                                           │
                    │  no DOM · no React · no localStorage ·    │
                    │  no Blob · no fetch · pure TS + math      │
                    └───────────────▲───────────────▲───────────┘
                                    │               │
              ┌─────────────────────┴──┐     ┌──────┴──────────────────┐
              │  web platform layer    │     │  (future) server/mobile │
              │  src/ui  (React, SVG)  │     │  handlers that call     │
              │  src/store (zustand +  │     │  exportInsertSTL() and  │
              │    localStorage)       │     │  email / return bytes   │
              │  src/ui/download.ts    │     └─────────────────────────┘
              │    (Blob download)     │
              └────────────────────────┘
```

`src/model`, `src/layout`, and `src/geometry` currently contain **zero**
browser/Node API references (checked in CI-adjacent review; keep it so). The only
web-coupled pieces are:

- `src/ui/**` — React + SVG rendering and forms
- `src/store/useDesignStore.ts` — zustand, persisted to `localStorage`
- `src/ui/download.ts` — turns the STL bytes into a browser file download

Everything a non-web caller needs is re-exported from **`src/core/index.ts`**.
`exportInsertSTL(project, container)` already returns `{ bytes: Uint8Array }` — it
does not touch the DOM, so it runs as-is in a serverless function.

## Future scope: hosted export + mobile clients

Planned, not built (see `PLAN.md` → "Beyond v1"):

1. **Extract the core to its own package** (`packages/core`, published or
   workspace-linked) so web, backend, and React Native depend on one copy of the
   model + geometry.
2. **Hosted export API** — a small stateless service:
   - `POST /v1/stl` with a project JSON body → `200` binary STL (or a signed
     download URL). Internally: `parseProject` → `validateLayout` (reject on
     errors) → `exportInsertSTL`.
   - `POST /v1/stl/email` with `{ project, email }` → generates the STL and
     emails it as an attachment. Same core call; delivery is the only new part.
   - Stateless and cache-friendly: the STL is a pure function of the request
     body, so responses can be cached by a hash of the normalized project.
3. **iOS / Android apps** — native or React Native UI for the arrange/verify
   loop, calling the hosted API for STL generation and the email hand-off. The
   web app keeps doing STL generation client-side (no server round trip needed
   for the browser); mobile uses the API so the geometry code isn't duplicated
   into Swift/Kotlin.

Design rule going forward: **new features land in `src/core` unless they are
inherently a UI or a storage concern.** If a change to layout or geometry needs a
browser API, that's a signal to move the browser part out to the platform layer.
