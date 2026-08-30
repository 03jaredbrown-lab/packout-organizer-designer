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

## iOS app — decided 2026-08-29: Expo (React Native), no backend for v1

`mobile/` is a React Native app built with Expo. It imports the shared core from
`../src/*` verbatim (Metro `watchFolders` → repo root) and does **all STL
generation on device**. The finished `.stl` is handed to the iOS share sheet
(`expo-sharing`) so the user can Mail / AirDrop / save it — no server involved.

**Why React Native over native Swift:** the geometry, validation, layout, and STL
code is already framework-free TypeScript. RN's JS engine runs it unchanged, and
Zustand + Zod work as-is. A Swift port would mean a second implementation of the
hard parts to keep in sync. RN also gets Android "for free" later (the user's
stated goal). Only the view layer is rewritten — SVG canvas → `react-native-svg`,
DOM forms → RN components, file download → share sheet.

**Why no backend for v1:** STL generation is `(project, container) → Uint8Array`,
pure and cheap; it runs fine on the phone. The share sheet covers "get the file
off my device". A server only becomes necessary for things the phone genuinely
can't do alone — see below.

### Still future scope (a backend, when it's actually needed)

1. **Extract the core to `packages/core`** (workspace-linked) so web, mobile, and
   any backend depend on one copy. `mobile/src/store.ts` currently duplicates the
   web store's reducers — that logic should move to the core in the same pass.
2. **Hosted export API** — a small stateless service:
   - `POST /v1/stl` (project JSON → binary STL). Internally: `parseProject` →
     `validateLayout` (reject on errors) → `exportInsertSTL`.
   - `POST /v1/stl/email` (`{ project, email }` → STL generated **and emailed**).
     This is the one feature that truly needs a server; the on-device share sheet
     is the v1 substitute.
   - Pure function of the body → cache on a project hash.
3. **Shared/synced tool libraries and accounts** — also server-side when they land.

Design rule going forward: **new features land in `src/core` unless they are
inherently a UI or a storage concern.** If a change to layout or geometry needs a
browser API, that's a signal to move the browser part out to the platform layer.
