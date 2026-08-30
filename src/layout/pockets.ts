import type { GlobalParams, Placement, Project, Tool, UsableContainer } from "../model/types";
import { isUsableTool } from "../model/types";
import { boundingBox, rectPolygon, rotatePolygon, type Polygon, type Rect } from "./geometry2d";

export interface ResolvedPocket {
  placementId: string;
  toolId: string;
  toolName: string;
  /** Footprint polygon in layout mm, clearance already applied, rotation already applied. */
  footprint: Polygon;
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
  const { l, w, h } = tool.bbox_mm;
  const clearance = resolveClearance(tool, placement, g);

  // Uniform clearance = expand the axis-aligned footprint by `clearance` on every
  // side, then rotate the whole pocket about its centre.
  const expanded: Rect = {
    x: placement.x_mm - clearance,
    y: placement.y_mm - clearance,
    w: l + 2 * clearance,
    h: w + 2 * clearance,
  };
  let poly = rectPolygon(expanded);
  if (placement.rot_deg % 360 !== 0) poly = rotatePolygon(poly, placement.rot_deg);

  return {
    placementId: placement.id,
    toolId: tool.id,
    toolName: tool.name,
    footprint: poly,
    bounds: boundingBox(poly),
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
