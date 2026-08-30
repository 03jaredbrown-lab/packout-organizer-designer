import { describe, expect, it } from "vitest";
import { validateLayout } from "./validate";
import { DEFAULT_GLOBALS, type Project, type Tool, type UsableContainer } from "../model/types";

function container(over: Partial<UsableContainer["internal"]> = {}): UsableContainer {
  return {
    id: "test",
    name: "Test cavity",
    modelNumbers: [],
    family: "organizer",
    internal: { x_mm: 200, y_mm: 300, z_mm: 50, ...over },
    features: { hasRemovableBins: false, floorProfile: "flat", cornerRadius_mm: null },
    verified: true,
    source: "test",
    notes: "",
  };
}

function tool(id: string, l: number, w: number, h: number): Tool {
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
    source: "test",
    notes: "",
  };
}

function project(tools: Tool[], placements: Project["placements"]): Project {
  return {
    schema: 1,
    name: "p",
    containerId: "test",
    units: "mm",
    global: { ...DEFAULT_GLOBALS, minWall_mm: 2 },
    tools,
    placements,
  };
}

describe("validateLayout", () => {
  it("passes a clean single-pocket layout", () => {
    const p = project(
      [tool("drill", 50, 30, 40)],
      [{ id: "a", toolId: "drill", x_mm: 20, y_mm: 20, rot_deg: 0, overrides: {} }],
    );
    const res = validateLayout(p, container());
    expect(res.ok).toBe(true);
    expect(res.errorCount).toBe(0);
  });

  it("flags an out-of-bounds pocket", () => {
    const p = project(
      [tool("drill", 50, 30, 40)],
      [{ id: "a", toolId: "drill", x_mm: 180, y_mm: 20, rot_deg: 0, overrides: {} }],
    );
    const res = validateLayout(p, container());
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "out-of-bounds")).toBe(true);
  });

  it("flags overlapping pockets", () => {
    const p = project(
      [tool("a", 50, 30, 40), tool("b", 50, 30, 40)],
      [
        { id: "p1", toolId: "a", x_mm: 20, y_mm: 20, rot_deg: 0, overrides: {} },
        { id: "p2", toolId: "b", x_mm: 40, y_mm: 30, rot_deg: 0, overrides: {} },
      ],
    );
    const res = validateLayout(p, container());
    expect(res.issues.some((i) => i.code === "overlap")).toBe(true);
  });

  it("warns when two pockets are closer than the min wall", () => {
    const p = project(
      [tool("a", 40, 30, 40), tool("b", 40, 30, 40)],
      [
        { id: "p1", toolId: "a", x_mm: 20, y_mm: 20, rot_deg: 0, overrides: {} },
        // a occupies x 19..61 (with 1mm clearance); place b so the gap is ~1mm < 2mm minWall
        { id: "p2", toolId: "b", x_mm: 63, y_mm: 20, rot_deg: 0, overrides: {} },
      ],
    );
    const res = validateLayout(p, container());
    expect(res.issues.some((i) => i.code === "min-wall-neighbour")).toBe(true);
    expect(res.errorCount).toBe(0);
  });

  it("errors when the insert is taller than the cavity minus lid clearance", () => {
    const p = project(
      [tool("tall", 50, 30, 90)],
      [{ id: "a", toolId: "tall", x_mm: 20, y_mm: 20, rot_deg: 0, overrides: { depth_mm: 80 } }],
    );
    const res = validateLayout(p, container({ z_mm: 50 }));
    expect(res.issues.some((i) => i.code === "too-tall")).toBe(true);
  });

  it("errors on a placed tool with a missing dimension", () => {
    const incomplete: Tool = { ...tool("x", 10, 10, 10), bbox_mm: { l: 10, w: null, h: 10 } };
    const p = project(
      [incomplete],
      [{ id: "a", toolId: "x", x_mm: 20, y_mm: 20, rot_deg: 0, overrides: {} }],
    );
    const res = validateLayout(p, container());
    expect(res.issues.some((i) => i.code === "unplaceable-tool")).toBe(true);
  });

  it("warns when the container is unverified", () => {
    const p = project(
      [tool("drill", 50, 30, 40)],
      [{ id: "a", toolId: "drill", x_mm: 20, y_mm: 20, rot_deg: 0, overrides: {} }],
    );
    const res = validateLayout(p, { ...container(), verified: false });
    expect(res.issues.some((i) => i.code === "container-unverified")).toBe(true);
  });
});
