# Proposed tech stack

Nothing here is installed yet — this is the proposal to react to before we commit
`package.json`.

## Frontend

| Concern | Choice | Why |
|---------|--------|-----|
| Language | **TypeScript** | dimensions, schemas, geometry math — types pay off fast |
| Build / dev server | **Vite** | fast HMR, zero-config, standard for this kind of SPA |
| UI framework | **React 18** | large ecosystem for both the canvas and 3D bindings |
| State | **Zustand** | small, no boilerplate; the layout store is the core of the app |
| 2D arrangement canvas | **react-konva** (Konva) | drag/rotate/transform handles, hit-testing, layers out of the box |
| 3D preview | **react-three-fiber** + **three.js** + **@react-three/drei** | declarative three.js; drei gives camera controls, grid, helpers |
| Parametric geometry / CSG | **@jscad/modeling** | pure JS, parametric, designed for 3D printing, direct STL serialize |
| CSG fallback | **manifold-3d** (wasm) | guaranteed manifold booleans if JSCAD struggles on complex layouts |
| STL export | `@jscad/stl-serializer` (with JSCAD) or a small custom writer over a three `BufferGeometry` | binary STL, mm units |
| Styling | CSS modules or Tailwind | low stakes; pick during M1 |
| Tests | **Vitest** | layout validation + geometry are pure functions and very testable |

## Why not...

- **OpenSCAD (openscad-wasm)** as the primary engine: biggest wasm payload,
  slowest regen, awkward to drive parametrically from JS state. Great for a
  "power export" mode later; wrong choice for the interactive loop.
- **A backend / DB in v1**: the whole app is a pure function of
  `(container, tools, layout, params) -> STL`. Ship it as a static site; add a
  server only when shared libraries or accounts actually land.
- **Plain `<canvas>` for arrangement**: doable, but we'd rebuild selection,
  transform handles, and hit-testing that Konva already provides.

## Deployment

Static build -> any static host (GitHub Pages, Netlify, Cloudflare Pages).
Decide at M5; irrelevant until then.

## Repo layout (planned)

```
/data                 container + tool libraries (static JSON, in git)
/src
  /model              types + zod schemas (container, tool, project)
  /layout             placement + validation (pure, tested)
  /geometry           GeometryEngine interface + jscad implementation
  /ui
    /canvas2d         react-konva arrangement view
    /preview3d        react-three-fiber insert preview
    /panels           tool entry, pocket params, verify checklist
  /store              zustand stores
/docs
```
