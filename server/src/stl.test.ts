import { describe, expect, it } from "vitest";
import { buildStl } from "./stl.js";
import { createProject, DEFAULT_GLOBALS, type Project, type Tool } from "../../src/core";

const drill: Tool = {
  id: "drill",
  name: "Test drill",
  brand: "",
  modelNumbers: [],
  category: "drill",
  bbox_mm: { l: 150, w: 45, h: 40 },
  outline: null,
  pocket: { style: "bbox", clearance_mm: 1, depth_mm: null, fingerScoop: true },
  verified: true,
  source: "test",
  notes: "",
};

/** A layout on the low-profile compact organizer (which has a spec cavity). */
function goodProject(): Project {
  return {
    ...createProject("lp-compact-organizer", "API test"),
    global: DEFAULT_GLOBALS,
    tools: [drill],
    placements: [{ id: "p1", toolId: "drill", x_mm: 20, y_mm: 20, rot_deg: 0, overrides: {} }],
  };
}

describe("buildStl", () => {
  it("400s on a non-project body", () => {
    const r = buildStl({ project: { nope: true } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("404s on an unknown container id", () => {
    const r = buildStl({ project: { ...goodProject(), containerId: "does-not-exist" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("422s when the container has no cavity and no override is given", () => {
    const r = buildStl({ project: { ...goodProject(), containerId: "deep-organizer" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("accepts an override that supplies the cavity", () => {
    const r = buildStl({
      project: { ...goodProject(), containerId: "deep-organizer" },
      override: { x_mm: 480, y_mm: 300, z_mm: 140, verified: true },
    });
    expect(r.ok).toBe(true);
  });

  it("422s with issues when the layout has a fit error", () => {
    const p = goodProject();
    p.placements = [{ id: "p1", toolId: "drill", x_mm: 5000, y_mm: 20, rot_deg: 0, overrides: {} }];
    const r = buildStl({ project: p });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.issues?.length).toBeGreaterThan(0);
    }
  });

  it("returns a binary STL for a valid layout", () => {
    const r = buildStl({ project: goodProject() });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filename).toMatch(/\.stl$/);
      expect(r.bytes).toBeInstanceOf(Uint8Array);
      // binary STL: 80-byte header + uint32 count + 50 bytes/triangle
      expect((r.bytes.byteLength - 84) % 50).toBe(0);
      const count = new DataView(r.bytes.buffer).getUint32(80, true);
      expect(count).toBe(r.triangleCount);
      expect(r.triangleCount).toBeGreaterThan(0);
    }
  });
});
