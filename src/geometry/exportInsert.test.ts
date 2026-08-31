import { describe, expect, it } from "vitest";
import { buildInsertRequest, exportInsertSTL } from "./exportInsert";
import { DEFAULT_GLOBALS, type Project, type Tool, type UsableContainer } from "../model/types";

const container: UsableContainer = {
  id: "c",
  name: "Test cavity",
  modelNumbers: [],
  family: "organizer",
  internal: { x_mm: 300, y_mm: 400, z_mm: 80 },
  features: { hasRemovableBins: false, floorProfile: "flat", cornerRadius_mm: null },
  verified: true,
  source: "test",
  notes: "",
};

const contouredTool: Tool = {
  id: "impact",
  name: "M18 FUEL Impact",
  brand: "Milwaukee",
  modelNumbers: [],
  category: "impact",
  bbox_mm: { l: 113.5, w: 124, h: 66 },
  outline: null,
  pocketRects: [
    { x: 0, y: 28, w: 16, h: 22 },
    { x: 14, y: 0, w: 42, h: 78 },
    { x: 40, y: 8, w: 73, h: 54 },
    { x: 50, y: 58, w: 37, h: 50 },
    { x: 44, y: 100, w: 52, h: 24 },
  ],
  pocket: { style: "outline", clearance_mm: 1.2, depth_mm: 20, fingerScoop: true },
  verified: false,
  source: "test",
  notes: "",
};

function project(): Project {
  return {
    schema: 1,
    name: "contour test",
    containerId: "c",
    units: "mm",
    global: DEFAULT_GLOBALS,
    tools: [contouredTool],
    placements: [{ id: "p1", toolId: "impact", x_mm: 40, y_mm: 40, rot_deg: 0, overrides: {} }],
  };
}

describe("buildInsertRequest", () => {
  it("carves one region per outline part (plus one finger scoop)", () => {
    const req = buildInsertRequest(project(), container);
    // 5 outline rectangles -> at least 5 carve regions
    expect(req.pockets.length).toBeGreaterThanOrEqual(5);
    // exactly one part carries the finger scoop
    expect(req.pockets.filter((p) => p.fingerScoop)).toHaveLength(1);
    // the scooped part is the one reaching furthest in +y (the grip foot)
    const scooped = req.pockets.find((p) => p.fingerScoop)!;
    const maxBottom = Math.max(...req.pockets.map((p) => p.bounds.y + p.bounds.h));
    expect(scooped.bounds.y + scooped.bounds.h).toBeCloseTo(maxBottom, 5);
  });

  it("every carve region sits inside the tool's clearance-expanded bounds", () => {
    const req = buildInsertRequest(project(), container);
    for (const p of req.pockets) {
      expect(p.bounds.x).toBeGreaterThanOrEqual(40 - 1.2 - 1e-6);
      expect(p.bounds.x + p.bounds.w).toBeLessThanOrEqual(40 + 113.5 + 1.2 + 1e-6);
    }
  });
});

describe("exportInsertSTL", () => {
  it("produces a valid binary STL for a contoured pocket", () => {
    const { bytes, result } = exportInsertSTL(project(), container);
    expect((bytes.byteLength - 84) % 50).toBe(0);
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(80, true)).toBe(result.triangleCount);
    expect(result.triangleCount).toBeGreaterThan(0);
  });
});
