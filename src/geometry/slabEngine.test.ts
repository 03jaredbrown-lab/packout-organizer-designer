import { describe, expect, it } from "vitest";
import { SlabGeometryEngine } from "./slabEngine";
import { meshBounds } from "./mesh";

const engine = new SlabGeometryEngine();

describe("SlabGeometryEngine", () => {
  it("makes a plain slab when there are no pockets", () => {
    const r = engine.generateInsert({
      footprint: { x: 0, y: 0, w: 100, h: 60 },
      baseThickness_mm: 4,
      pockets: [],
    });
    expect(r.height_mm).toBe(4);
    const b = meshBounds(r.mesh);
    expect(b.min).toEqual([0, 0, 0]);
    expect(b.max).toEqual([100, 60, 4]);
    expect(r.triangleCount).toBe(12); // single merged box
  });

  it("raises total height to base + deepest pocket and leaves a floor under each pocket", () => {
    const r = engine.generateInsert({
      footprint: { x: 0, y: 0, w: 100, h: 100 },
      baseThickness_mm: 3,
      pockets: [{ bounds: { x: 20, y: 20, w: 30, h: 30 }, depth_mm: 25, fingerScoop: false }],
    });
    expect(r.height_mm).toBe(28); // 3 + 25
    const b = meshBounds(r.mesh);
    expect(b.max[2]).toBeCloseTo(28, 5); // wall height somewhere
    // the pocket floor is height - depth = 3
    const floorTop = Math.min(
      ...r.mesh.triangles.flatMap((t) => [t.a[2], t.b[2], t.c[2]]).filter((z) => z > 0),
    );
    expect(floorTop).toBeCloseTo(3, 5);
  });

  it("cuts a finger-scoop notch on the +y wall of the pocket", () => {
    const opts = {
      footprint: { x: 0, y: 0, w: 100, h: 100 },
      baseThickness_mm: 3,
      pocket: { bounds: { x: 30, y: 30, w: 30, h: 30 }, depth_mm: 12 },
    };
    const withScoop = engine.generateInsert({
      footprint: opts.footprint,
      baseThickness_mm: opts.baseThickness_mm,
      pockets: [{ ...opts.pocket, fingerScoop: true }],
    });
    const noScoop = engine.generateInsert({
      footprint: opts.footprint,
      baseThickness_mm: opts.baseThickness_mm,
      pockets: [{ ...opts.pocket, fingerScoop: false }],
    });

    expect(withScoop.notes.join(" ")).toMatch(/scoop/i);

    // "carved to the pocket floor past the pocket's +y edge (y > 60)": a mesh
    // vertex at floor level (z = height - depth = 3) with y beyond the pocket.
    const carvedPastEdge = (r: typeof withScoop) =>
      r.mesh.triangles.some((t) =>
        [t.a, t.b, t.c].some((p) => p[1] > 60 + 1e-6 && Math.abs(p[2] - 3) < 1e-3),
      );

    expect(carvedPastEdge(withScoop)).toBe(true);
    expect(carvedPastEdge(noScoop)).toBe(false);
  });

  it("clips pockets that spill past the footprint", () => {
    const r = engine.generateInsert({
      footprint: { x: 0, y: 0, w: 40, h: 40 },
      baseThickness_mm: 3,
      pockets: [{ bounds: { x: 30, y: 30, w: 40, h: 40 }, depth_mm: 5, fingerScoop: false }],
    });
    const b = meshBounds(r.mesh);
    expect(b.max[0]).toBeCloseTo(40, 5);
    expect(b.max[1]).toBeCloseTo(40, 5);
  });
});
