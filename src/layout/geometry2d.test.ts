import { describe, expect, it } from "vitest";
import {
  boundingBox,
  marginInsideBounds,
  polygonGap,
  polygonsOverlap,
  rectPolygon,
  rotatePolygon,
} from "./geometry2d";

const rect = (x: number, y: number, w: number, h: number) => rectPolygon({ x, y, w, h });

describe("polygonsOverlap", () => {
  it("detects overlapping rectangles", () => {
    expect(polygonsOverlap(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
  });

  it("treats edge-touching rectangles as not overlapping", () => {
    expect(polygonsOverlap(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
  });

  it("separated rectangles do not overlap", () => {
    expect(polygonsOverlap(rect(0, 0, 10, 10), rect(20, 0, 10, 10))).toBe(false);
  });

  it("detects overlap after rotation", () => {
    const a = rect(0, 0, 10, 2);
    const b = rotatePolygon(rect(4, -4, 10, 2), 90); // becomes tall, crossing a
    expect(polygonsOverlap(a, b)).toBe(true);
  });
});

describe("polygonGap", () => {
  it("is the clear distance between separated rects", () => {
    expect(polygonGap(rect(0, 0, 10, 10), rect(13, 0, 10, 10))).toBeCloseTo(3, 5);
  });

  it("is zero when touching or overlapping", () => {
    expect(polygonGap(rect(0, 0, 10, 10), rect(10, 0, 5, 5))).toBe(0);
    expect(polygonGap(rect(0, 0, 10, 10), rect(2, 2, 3, 3))).toBe(0);
  });
});

describe("rotatePolygon", () => {
  it("rotates about the centroid and preserves the bounding box size for 90 deg", () => {
    const p = rotatePolygon(rect(0, 0, 20, 6), 90);
    const bb = boundingBox(p);
    expect(bb.w).toBeCloseTo(6, 5);
    expect(bb.h).toBeCloseTo(20, 5);
    // centroid stays put
    expect(bb.x + bb.w / 2).toBeCloseTo(10, 5);
    expect(bb.y + bb.h / 2).toBeCloseTo(3, 5);
  });
});

describe("marginInsideBounds", () => {
  const bounds = { x: 0, y: 0, w: 100, h: 100 };

  it("is positive when the polygon is comfortably inside", () => {
    expect(marginInsideBounds(rect(10, 10, 20, 20), bounds)).toBeCloseTo(10, 5);
  });

  it("is negative when the polygon hangs over an edge", () => {
    expect(marginInsideBounds(rect(90, 10, 20, 20), bounds)).toBeCloseTo(-10, 5);
  });
});
