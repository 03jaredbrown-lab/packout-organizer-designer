import { describe, expect, it } from "vitest";
import { autoArrange } from "./autoArrange";
import { DEFAULT_GLOBALS, type Placement, type Tool } from "../model/types";

function tool(id: string, l: number, w: number, h = 40): Tool {
  return {
    id,
    name: id,
    brand: "",
    modelNumbers: [],
    category: "other",
    bbox_mm: { l, w, h },
    outline: null,
    pocket: { style: "bbox", clearance_mm: 0, depth_mm: null, fingerScoop: false },
    verified: true,
    source: "",
    notes: "",
  };
}

function placement(id: string, toolId: string): Placement {
  return { id, toolId, x_mm: 0, y_mm: 0, rot_deg: 0, overrides: {} };
}

const footprint = { x: 0, y: 0, w: 200, h: 300 };
const g = { ...DEFAULT_GLOBALS, minWall_mm: 2 };

describe("autoArrange", () => {
  it("lays tools in a row until the footprint width is exceeded, then wraps", () => {
    const tools = [tool("a", 80, 50), tool("b", 80, 50), tool("c", 80, 50)];
    const placements = ["a", "b", "c"].map((t) => placement(t, t));
    const out = autoArrange(placements, tools, footprint, g);
    const byId = Object.fromEntries(out.map((p) => [p.id, p]));

    // a and b fit on row 1 (2 + 80 + 2 + 80 = 164 < 198), c wraps to row 2
    expect(byId.a.y_mm).toBeCloseTo(2, 5);
    expect(byId.b.y_mm).toBeCloseTo(2, 5);
    expect(byId.b.x_mm).toBeGreaterThan(byId.a.x_mm);
    expect(byId.c.y_mm).toBeGreaterThan(byId.a.y_mm);
    expect(byId.c.x_mm).toBeCloseTo(2, 5);
  });

  it("does not overlap neighbours in a row (gap >= minWall)", () => {
    const tools = [tool("a", 60, 40), tool("b", 60, 40)];
    const placements = ["a", "b"].map((t) => placement(t, t));
    const out = autoArrange(placements, tools, footprint, g);
    const byId = Object.fromEntries(out.map((p) => [p.id, p]));
    const gapBetween = byId.b.x_mm - (byId.a.x_mm + 60);
    expect(gapBetween).toBeGreaterThanOrEqual(2 - 1e-9);
  });

  it("leaves placements with an incomplete tool bbox untouched", () => {
    const incomplete: Tool = { ...tool("x", 10, 10), bbox_mm: { l: 10, w: null, h: 10 } };
    const placements = [{ ...placement("p", "x"), x_mm: 123, y_mm: 45 }];
    const out = autoArrange(placements, [incomplete], footprint, g);
    expect(out[0].x_mm).toBe(123);
    expect(out[0].y_mm).toBe(45);
  });

  it("keeps every placement (fitting or not)", () => {
    const tools = [tool("big", 500, 50)];
    const placements = [placement("p", "big")];
    const out = autoArrange(placements, tools, footprint, g);
    expect(out).toHaveLength(1);
    expect(out[0].rot_deg).toBe(0);
  });
});
