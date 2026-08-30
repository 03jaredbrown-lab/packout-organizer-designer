import { describe, expect, it } from "vitest";
import {
  addAndPlaceTool,
  arrangeProject,
  mergeContainer,
  mergeOverride,
  patchPlacement,
  placeTool,
  removeTool,
} from "./designOps";
import { createProject } from "../model/project";
import type { Container, Tool } from "../model/types";

function baseContainer(x: number | null = null): Container {
  return {
    id: "c",
    name: "C",
    modelNumbers: [],
    family: "organizer",
    internal: { x_mm: x, y_mm: x == null ? null : 300, z_mm: x == null ? null : 60 },
    features: { hasRemovableBins: false, floorProfile: "flat", cornerRadius_mm: null },
    verified: false,
    source: "spec",
    notes: "",
  };
}

function tool(id: string, l: number | null, w: number | null, h: number | null): Tool {
  return {
    id,
    name: id,
    brand: "",
    modelNumbers: [],
    category: "other",
    bbox_mm: { l, w, h },
    outline: null,
    pocket: { style: "bbox", clearance_mm: 1, depth_mm: null, fingerScoop: false },
    verified: true,
    source: "",
    notes: "",
  };
}

describe("mergeContainer", () => {
  it("overlays user measurements and marks the source", () => {
    const merged = mergeContainer(baseContainer(), {
      x_mm: 200,
      y_mm: 300,
      z_mm: 50,
      verified: true,
    });
    expect(merged.internal).toEqual({ x_mm: 200, y_mm: 300, z_mm: 50 });
    expect(merged.verified).toBe(true);
    expect(merged.source).toMatch(/user-measured/);
  });

  it("returns the base untouched when there is no override", () => {
    const base = baseContainer(180);
    expect(mergeContainer(base, undefined)).toBe(base);
  });
});

describe("mergeOverride", () => {
  it("fills defaults then previous then patch", () => {
    expect(mergeOverride(undefined, { x_mm: 10 })).toEqual({
      x_mm: 10,
      y_mm: null,
      z_mm: null,
      verified: false,
    });
    expect(mergeOverride({ x_mm: 1, y_mm: 2, z_mm: 3, verified: true }, { z_mm: 9 })).toEqual({
      x_mm: 1,
      y_mm: 2,
      z_mm: 9,
      verified: true,
    });
  });
});

describe("placeTool / addAndPlaceTool", () => {
  it("placeTool appends a placement and returns its id", () => {
    const p0 = { ...createProject("c"), tools: [tool("d", 50, 30, 40)] };
    const { project, placementId } = placeTool(p0, "d");
    expect(project.placements).toHaveLength(1);
    expect(project.placements[0].id).toBe(placementId);
  });

  it("addAndPlaceTool adds the tool, places it, and arranges when the cavity is known", () => {
    const container = mergeContainer(baseContainer(), { x_mm: 200, y_mm: 300, z_mm: 60, verified: true });
    const out = addAndPlaceTool(createProject("c"), tool("d", 50, 30, 40), container);
    expect(out.tools.map((t) => t.id)).toContain("d");
    expect(out.placements).toHaveLength(1);
    // arranged into the footprint, not left at the raw default
    expect(out.placements[0].x_mm).toBeGreaterThan(0);
  });

  it("addAndPlaceTool does not place a tool with an incomplete bbox", () => {
    const out = addAndPlaceTool(createProject("c"), tool("x", 10, null, 10), undefined);
    expect(out.tools).toHaveLength(1);
    expect(out.placements).toHaveLength(0);
  });
});

describe("arrangeProject", () => {
  it("is a no-op without a usable container", () => {
    const p = placeTool({ ...createProject("c"), tools: [tool("d", 50, 30, 40)] }, "d").project;
    expect(arrangeProject(p, baseContainer())).toBe(p);
  });
});

describe("patchPlacement / removeTool", () => {
  it("patchPlacement only touches the matching id", () => {
    let p = placeTool({ ...createProject("c"), tools: [tool("a", 10, 10, 10)] }, "a").project;
    const id = p.placements[0].id;
    p = patchPlacement(p, id, (pl) => ({ ...pl, rot_deg: 90 }));
    expect(p.placements[0].rot_deg).toBe(90);
    expect(patchPlacement(p, "nope", (pl) => ({ ...pl, rot_deg: 45 }))).toEqual(p);
  });

  it("removeTool drops the tool and its placements", () => {
    let p = { ...createProject("c"), tools: [tool("a", 10, 10, 10)] };
    p = placeTool(p, "a").project;
    p = removeTool(p, "a");
    expect(p.tools).toHaveLength(0);
    expect(p.placements).toHaveLength(0);
  });
});
