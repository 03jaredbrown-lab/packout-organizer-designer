import type { GlobalParams, Placement, Project, Tool, UsableContainer } from "../model/types";
import { isUsableTool } from "../model/types";
import { boundingBox, rectPolygon, rotatePolygon, type Polygon, type Rect } from "./geometry2d";
import { toolShapeRects } from "./toolShape";

export interface ResolvedPocket {
  placementId: string;
  toolId: string;
  toolName: string;
  /**
   * Outer footprint polygon in layout mm — clearance and rotation applied. For
   * a contoured tool this is the convex outline of the whole pocket; use
   * `footprintParts` for the exact shape.
   */
  footprint: Polygon;
  /**
   * The pocket as a union of convex parts (one rectangle each), clearance and
   * rotation applied. One entry for a plain bbox pocket, two or three for an
   * L-/T-shaped power tool. This is what fit checks and the carve should use.
   */
  footprintParts: Polygon[];
  /** Axis-aligned bounds of the footprint. */
  bounds: Rect;
  clearance_mm: number;
  depth_mm: number;
  fingerScoop: boolean;
  /** Height of the tool itself (bbox h). */
  toolHeight_mm: number;
}

export function resolveClearance(tool: Tool, placement: Placement, g: GlobalParams): number {
  return placement.overrides.clearance_mm ?? tool.pocket.clearance_mm ?? g.defaultClearance_mm;
}

export function autoDepth(toolHeight_mm: number): number {
  return Math.min(toolHeight_mm, Math.max(8, toolHeight_mm * 0.6));
}

export function resolveDepth(tool: Tool, placement: Placement, toolHeight_mm: number): number {
  return placement.overrides.depth_mm ?? tool.pocket.depth_mm ?? autoDepth(toolHeight_mm);
}

export function resolveFingerScoop(tool: Tool, placement: Placement): boolean {
  return placement.overrides.fingerScoop ?? tool.pocket.fingerScoop;
}

/** Build the pocket footprint for one placement. Returns null if the tool has no complete bbox. */
export function resolvePocket(
  placement: Placement,
  tool: Tool,
  g: GlobalParams,
): ResolvedPocket | null {
  if (!isUsableTool(tool)) return null;
  const { h } = tool.bbox_mm;
  const clearance = resolveClearance(tool, placement, g);

  // Tool-local shape rectangles (x along length, y along width). Expand each by
  // `clearance` on every side and translate to the placement origin. Parts of a
  // contoured shape may overlap once expanded — that is fine, their union is the
  // pocket; a narrow concave notch simply fills in with support material.
  const expanded: Rect[] = toolShapeRects(tool).map((r) => ({
    x: placement.x_mm + r.x - clearance,
    y: placement.y_mm + r.y - clearance,
    w: r.w + 2 * clearance,
    h: r.h + 2 * clearance,
  }));

  // Rotate every part about one shared centre: the centre of the un-rotated
  // union bounds, so the parts stay locked together.
  const preBounds = boundingBox(expanded.flatMap(rectPolygon));
  const centre = { x: preBounds.x + preBounds.w / 2, y: preBounds.y + preBounds.h / 2 };
  const rot = placement.rot_deg % 360;
  const rotate = (poly: Polygon) => (rot !== 0 ? rotatePolygon(poly, rot, centre) : poly);

  const footprintParts = expanded.map((r) => rotate(rectPolygon(r)));
  const footprint = rotate(rectPolygon(preBounds));

  return {
    placementId: placement.id,
    toolId: tool.id,
    toolName: tool.name,
    footprint,
    footprintParts,
    bounds: boundingBox(footprint),
    clearance_mm: clearance,
    depth_mm: resolveDepth(tool, placement, h),
    fingerScoop: resolveFingerScoop(tool, placement),
    toolHeight_mm: h,
  };
}

export function resolveAllPockets(project: Project): ResolvedPocket[] {
  const toolById = new Map(project.tools.map((t) => [t.id, t]));
  const out: ResolvedPocket[] = [];
  for (const p of project.placements) {
    const tool = toolById.get(p.toolId);
    if (!tool) continue;
    const pocket = resolvePocket(p, tool, project.global);
    if (pocket) out.push(pocket);
  }
  return out;
}

/** The rectangle an insert occupies inside the cavity, i.e. cavity minus edge clearance. */
export function insertFootprint(container: UsableContainer, g: GlobalParams): Rect {
  return {
    x: g.edgeClearance_mm,
    y: g.edgeClearance_mm,
    w: container.internal.x_mm - 2 * g.edgeClearance_mm,
    h: container.internal.y_mm - 2 * g.edgeClearance_mm,
  };
}
