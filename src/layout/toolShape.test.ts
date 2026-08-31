import { describe, expect, it } from "vitest";
import { hasContouredShape, toolShapeRects } from "./toolShape";
import type { Tool, ToolCategory } from "../model/types";

function tool(
  name: string,
  category: ToolCategory,
  l: number | null,
  w: number | null,
  style: Tool["pocket"]["style"] = "bbox",
): Tool {
  return {
    id: name,
    name,
    brand: "",
    modelNumbers: [],
    category,
    bbox_mm: { l, w, h: 40 },
    outline: null,
    pocket: { style, clearance_mm: 1, depth_mm: null, fingerScoop: false },
    verified: true,
    source: "",
    notes: "",
  };
}

/** Union bbox of a rect list. */
function union(rects: { x: number; y: number; w: number; h: number }[]) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

describe("toolShapeRects", () => {
  it("returns a single bbox rect for an unrecognised tool", () => {
    const r = toolShapeRects(tool("widget", "other", 120, 60));
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ x: 0, y: 0, w: 120, h: 60 });
  });

  it("gives a drill a two-part (barrel + grip) silhouette", () => {
    const r = toolShapeRects(tool("M18 FUEL Drill/Driver", "drill", 180, 70));
    expect(r.length).toBe(2);
    expect(hasContouredShape(tool("M18 FUEL Drill/Driver", "drill", 180, 70))).toBe(true);
  });

  it("recognises an impact by name even when the category is 'other'", () => {
    const r = toolShapeRects(tool("M18 impact", "other", 140, 45));
    expect(r.length).toBe(2);
  });

  it("keeps every part inside the tool bounding box", () => {
    const r = toolShapeRects(tool("circular saw", "saw", 250, 200));
    for (const part of r) {
      expect(part.x).toBeGreaterThanOrEqual(0);
      expect(part.y).toBeGreaterThanOrEqual(0);
      expect(part.x + part.w).toBeLessThanOrEqual(250 + 1e-9);
      expect(part.y + part.h).toBeLessThanOrEqual(200 + 1e-9);
    }
    const u = union(r);
    // the silhouette spans the full length and width of the bbox
    expect(u.w).toBeCloseTo(250, 5);
    expect(u.h).toBeCloseTo(200, 5);
  });

  it("falls back to bbox when a dimension is missing", () => {
    expect(toolShapeRects(tool("M18 impact", "impact", 140, null))).toEqual([
      { x: 0, y: 0, w: 140, h: 0 },
    ]);
  });

  it("honours pocket.style 'cylinder' as a plain bbox for now", () => {
    const r = toolShapeRects(tool("M18 impact", "impact", 140, 45, "cylinder"));
    expect(r).toHaveLength(1);
  });
});
