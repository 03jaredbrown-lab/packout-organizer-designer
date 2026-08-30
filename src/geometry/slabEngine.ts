import type { GeometryEngine, InsertRequest, InsertResult, PocketSolid } from "./GeometryEngine";
import { box, mergeMeshes, type Mesh } from "./mesh";
import type { Rect } from "../layout/geometry2d";

const EPS = 1e-6;

function uniqueSorted(values: number[]): number[] {
  const out = [...values].sort((a, b) => a - b);
  return out.filter((v, i) => i === 0 || v - out[i - 1] > EPS);
}

function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x - EPS && x <= r.x + r.w + EPS && y >= r.y - EPS && y <= r.y + r.h + EPS;
}

/**
 * Grid-decomposition insert generator.
 *
 * The insert is a slab of height `baseThickness + max(pocketDepth)`. The plan is
 * cut on every pocket edge into a grid of cells; each cell is extruded to full
 * height where it is solid, or to `height - pocketDepth` where it sits under a
 * pocket. Cells in a row that share a top height are merged along x to keep the
 * triangle count down. The result is a union of axis-aligned boxes: watertight
 * in practice and accepted by every common slicer, though not strictly manifold
 * where boxes meet. Finger scoops and non-90 degree rotations are noted, not yet
 * modelled.
 */
export class SlabGeometryEngine implements GeometryEngine {
  readonly id = "slab-grid-v1";

  generateInsert(req: InsertRequest): InsertResult {
    const { footprint, baseThickness_mm, pockets } = req;
    const notes: string[] = [];

    const clampedPockets = pockets.map((p) => clampPocketToFootprint(p, footprint));
    const maxDepth = clampedPockets.reduce((m, p) => Math.max(m, p.depth_mm), 0);
    const height = baseThickness_mm + maxDepth;

    if (clampedPockets.some((p) => p.fingerScoop)) {
      notes.push("Finger scoops are not modelled yet — pockets are printed as plain recesses.");
    }

    const xs = uniqueSorted([
      footprint.x,
      footprint.x + footprint.w,
      ...clampedPockets.flatMap((p) => [p.bounds.x, p.bounds.x + p.bounds.w]),
    ]).filter((x) => x >= footprint.x - EPS && x <= footprint.x + footprint.w + EPS);

    const ys = uniqueSorted([
      footprint.y,
      footprint.y + footprint.h,
      ...clampedPockets.flatMap((p) => [p.bounds.y, p.bounds.y + p.bounds.h]),
    ]).filter((y) => y >= footprint.y - EPS && y <= footprint.y + footprint.h + EPS);

    const meshes: Mesh[] = [];

    for (let j = 0; j < ys.length - 1; j++) {
      const y0 = ys[j];
      const y1 = ys[j + 1];
      const cy = (y0 + y1) / 2;

      let runStartX: number | null = null;
      let runTop = 0;

      const flush = (endX: number) => {
        if (runStartX == null) return;
        if (runTop > EPS) {
          meshes.push(box(runStartX, y0, 0, endX - runStartX, y1 - y0, runTop));
        }
        runStartX = null;
      };

      for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        const cx = (x0 + x1) / 2;

        if (!rectContains(footprint, cx, cy)) {
          flush(x0);
          continue;
        }

        const pocket = clampedPockets.find((p) => rectContains(p.bounds, cx, cy));
        const cellTop = pocket ? Math.max(0, height - pocket.depth_mm) : height;

        if (runStartX != null && Math.abs(cellTop - runTop) < EPS) {
          continue; // extend current run
        }
        flush(x0);
        if (cellTop > EPS) {
          runStartX = x0;
          runTop = cellTop;
        }
      }
      flush(xs[xs.length - 1]);
    }

    const mesh = mergeMeshes(meshes);
    return { mesh, height_mm: height, triangleCount: mesh.triangles.length, notes };
  }
}

function clampPocketToFootprint(p: PocketSolid, f: Rect): PocketSolid {
  const x0 = Math.max(p.bounds.x, f.x);
  const y0 = Math.max(p.bounds.y, f.y);
  const x1 = Math.min(p.bounds.x + p.bounds.w, f.x + f.w);
  const y1 = Math.min(p.bounds.y + p.bounds.h, f.y + f.h);
  return {
    ...p,
    bounds: { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) },
  };
}
