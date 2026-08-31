/**
 * Tool footprint shape — the top-down outline a pocket is carved to follow.
 *
 * A shape is a **union of axis-aligned rectangles** in tool-local millimetres:
 * x runs along the tool length (0..l), y along its width (0..w). One rectangle
 * is just the bounding box; two or three approximate an L- or T-shaped power
 * tool (barrel + pistol grip) well enough to read at a glance and to carve.
 *
 * Rectangles (rather than an arbitrary polygon) keep every downstream step
 * simple: the fit checks stay convex per-part, and the rectilinear STL engine
 * can carve each part directly.
 *
 * Portable core — no DOM, no React.
 */
import type { Tool, ToolCategory } from "../model/types";
import type { Rect } from "./geometry2d";

/** Shape family — coarser than ToolCategory; only these get a non-bbox outline. */
type ShapeKey = "gun" | "compact-gun" | "saw" | "bbox";

function shapeKey(category: ToolCategory, name: string): ShapeKey {
  const n = name.toLowerCase();
  if (/sawzall|reciprocating|recip saw|circular saw|\bsaw\b|grinder|multi-?tool|oscillating/.test(n))
    return "saw";
  if (/impact|\bwrench\b|ratchet/.test(n)) return "compact-gun";
  if (/hammer ?drill|\bdrill\b|\bdriver\b|rotary hammer/.test(n)) return "gun";
  if (category === "saw") return "saw";
  if (category === "impact") return "compact-gun";
  if (category === "drill" || category === "driver") return "gun";
  return "bbox";
}

function bbox(l: number, w: number): Rect[] {
  return [{ x: 0, y: 0, w: l, h: w }];
}

/**
 * A pistol-grip power tool seen from above: the barrel/body runs the full
 * length along the far edge; the grip drops toward the viewer under the rear
 * third. `bodyFrac` is how much of the width the body occupies.
 */
function gunShape(l: number, w: number, bodyFrac: number, gripStartFrac: number): Rect[] {
  const bodyH = w * bodyFrac;
  const gripX = l * gripStartFrac;
  const gripW = l * 0.34;
  return [
    { x: 0, y: 0, w: l, h: bodyH },
    { x: gripX, y: bodyH, w: gripW, h: w - bodyH },
  ];
}

function sawShape(l: number, w: number): Rect[] {
  // Motor body is tall and short; the blade/shoe runs forward at half width.
  return [
    { x: 0, y: 0, w: l * 0.58, h: w },
    { x: l * 0.5, y: w * 0.25, w: l * 0.5, h: w * 0.5 },
  ];
}

/** Clamp a shape's rectangles into the [0,l] x [0,w] bounding box. */
function clampToBbox(rects: Rect[], l: number, w: number): Rect[] {
  return rects.map((r) => {
    const x = Math.max(0, Math.min(r.x, l));
    const y = Math.max(0, Math.min(r.y, w));
    return { x, y, w: Math.min(r.w, l - x), h: Math.min(r.h, w - y) };
  });
}

/**
 * The pocket outline for a tool, as tool-local rectangles. `tool.bbox_mm` must
 * be complete (callers gate on `isUsableTool`); `l`/`w` default defensively.
 *
 * `pocket.style === "cylinder"` is not modelled yet and falls back to the plain
 * bounding box. The `"bbox"` vs `"outline"` distinction is intentionally *not*
 * consulted here: every tool in the current data still carries the old default
 * `"bbox"`, so treating that as "user wants a rectangle" would suppress every
 * silhouette. A later "plain rectangular pocket" toggle in the UI should set a
 * dedicated flag that this function then honours.
 */
export function toolShapeRects(tool: Tool): Rect[] {
  const l = tool.bbox_mm.l ?? 0;
  const w = tool.bbox_mm.w ?? 0;
  if (l <= 0 || w <= 0) return bbox(l, w);
  if (tool.pocket.style === "cylinder") return bbox(l, w);

  switch (shapeKey(tool.category, tool.name)) {
    case "gun":
      return clampToBbox(gunShape(l, w, 0.55, 0.12), l, w);
    case "compact-gun":
      return clampToBbox(gunShape(l, w, 0.62, 0.16), l, w);
    case "saw":
      return clampToBbox(sawShape(l, w), l, w);
    default:
      return bbox(l, w);
  }
}

/** True when the tool renders as more than a single rectangle. */
export function hasContouredShape(tool: Tool): boolean {
  return toolShapeRects(tool).length > 1;
}
