import { describe, expect, it } from "vitest";
import { box, meshBounds, serializeBinarySTL, triangleNormal } from "./mesh";

describe("box", () => {
  it("has 12 triangles and the requested bounds", () => {
    const m = box(1, 2, 3, 10, 20, 30);
    expect(m.triangles).toHaveLength(12);
    const b = meshBounds(m);
    expect(b.min).toEqual([1, 2, 3]);
    expect(b.max).toEqual([11, 22, 33]);
  });

  it("winds every face with an outward-pointing normal", () => {
    const m = box(0, 0, 0, 2, 2, 2);
    const center = [1, 1, 1];
    for (const t of m.triangles) {
      const n = triangleNormal(t);
      const centroid = [
        (t.a[0] + t.b[0] + t.c[0]) / 3,
        (t.a[1] + t.b[1] + t.c[1]) / 3,
        (t.a[2] + t.b[2] + t.c[2]) / 3,
      ];
      const outward = [
        centroid[0] - center[0],
        centroid[1] - center[1],
        centroid[2] - center[2],
      ];
      const dot = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2];
      expect(dot).toBeGreaterThan(0);
    }
  });
});

describe("serializeBinarySTL", () => {
  it("writes an 84-byte header block plus 50 bytes per triangle", () => {
    const m = box(0, 0, 0, 1, 1, 1);
    const bytes = serializeBinarySTL(m);
    expect(bytes.byteLength).toBe(84 + 12 * 50);
    const count = new DataView(bytes.buffer).getUint32(80, true);
    expect(count).toBe(12);
  });
});
