/** 2D geometry helpers for the top-down layout, all in millimetres. */

export interface Pt {
  x: number;
  y: number;
}

export type Polygon = Pt[];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPS = 1e-6;

export function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Axis-aligned rectangle as a polygon (CCW in screen space where y grows down). */
export function rectPolygon(r: Rect): Polygon {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

export function rotatePointAround(p: Pt, center: Pt, angleDeg: number): Pt {
  const a = deg2rad(angleDeg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function polygonCentroid(poly: Polygon): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/** Rotate a whole polygon about its own centroid. */
export function rotatePolygon(poly: Polygon, angleDeg: number, center?: Pt): Polygon {
  const c = center ?? polygonCentroid(poly);
  return poly.map((p) => rotatePointAround(p, c, angleDeg));
}

export function boundingBox(poly: Polygon): Rect {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function axes(poly: Polygon): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(edge.x, edge.y) || 1;
    // normal
    out.push({ x: -edge.y / len, y: edge.x / len });
  }
  return out;
}

function project(poly: Polygon, axis: Pt): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * axis.x + p.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Separating-axis overlap test for two convex polygons. Touching edges do not count as overlap. */
export function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  const allAxes = [...axes(a), ...axes(b)];
  for (const axis of allAxes) {
    const [amin, amax] = project(a, axis);
    const [bmin, bmax] = project(b, axis);
    if (amax <= bmin + EPS || bmax <= amin + EPS) {
      return false;
    }
  }
  return true;
}

/** Shortest distance between the boundaries of two convex polygons. 0 if they intersect or touch. */
export function polygonGap(a: Polygon, b: Polygon): number {
  if (polygonsOverlap(a, b)) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const d = segmentDistance(
        a[i],
        a[(i + 1) % a.length],
        b[j],
        b[(j + 1) % b.length],
      );
      if (d < best) best = d;
    }
  }
  return best;
}

function segmentDistance(p1: Pt, p2: Pt, p3: Pt, p4: Pt): number {
  return Math.min(
    pointSegmentDistance(p1, p3, p4),
    pointSegmentDistance(p2, p3, p4),
    pointSegmentDistance(p3, p1, p2),
    pointSegmentDistance(p4, p1, p2),
  );
}

function pointSegmentDistance(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  return Math.hypot(p.x - cx, p.y - cy);
}

/** Signed inset of a polygon from an axis-aligned bounds rect. Positive = margin, negative = overhang. */
export function marginInsideBounds(poly: Polygon, bounds: Rect): number {
  const bb = boundingBox(poly);
  return Math.min(
    bb.x - bounds.x,
    bb.y - bounds.y,
    bounds.x + bounds.w - (bb.x + bb.w),
    bounds.y + bounds.h - (bb.y + bb.h),
  );
}
