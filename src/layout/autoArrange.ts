import type { GlobalParams, Placement, Tool } from "../model/types";
import { isUsableTool } from "../model/types";
import { resolveClearance } from "./pockets";
import type { Rect } from "./geometry2d";

/**
 * Simple shelf (row) packing: lay the placeable tools left-to-right in rows
 * inside the insert footprint, wrapping to a new row when the current one is
 * full. Deterministic, keeps rotation at 0, and does not attempt to be optimal —
 * it gives the user a sensible starting arrangement to then drag around.
 *
 * Placements whose tool has no complete bounding box are left where they are.
 * Tools that do not fit the footprint at all are still placed (overflowing the
 * right/bottom edge) so the fit checker flags them rather than silently hiding
 * them.
 */
export function autoArrange(
  placements: Placement[],
  tools: Tool[],
  footprint: Rect,
  g: GlobalParams,
): Placement[] {
  const toolById = new Map(tools.map((t) => [t.id, t]));
  const gap = Math.max(g.minWall_mm, 0.5);

  const order = [...placements]
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      const t = toolById.get(p.toolId);
      return t != null && isUsableTool(t);
    })
    .sort((a, b) => {
      const ta = toolById.get(a.p.toolId)!;
      const tb = toolById.get(b.p.toolId)!;
      // tallest rows first (y-extent), then widest, then stable by original index
      return (tb.bbox_mm.w ?? 0) - (ta.bbox_mm.w ?? 0) ||
        (tb.bbox_mm.l ?? 0) - (ta.bbox_mm.l ?? 0) ||
        a.i - b.i;
    });

  const byId = new Map<string, Placement>();
  let cursorX = footprint.x + gap;
  let cursorY = footprint.y + gap;
  let rowHeight = 0;
  const rightEdge = footprint.x + footprint.w - gap;

  for (const { p } of order) {
    const tool = toolById.get(p.toolId)!;
    const c = resolveClearance(tool, p, g);
    const w = tool.bbox_mm.l! + 2 * c;
    const h = tool.bbox_mm.w! + 2 * c;

    if (cursorX > footprint.x + gap && cursorX + w > rightEdge) {
      cursorX = footprint.x + gap;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }

    byId.set(p.id, { ...p, x_mm: cursorX + c, y_mm: cursorY + c, rot_deg: 0 });

    cursorX += w + gap;
    rowHeight = Math.max(rowHeight, h);
  }

  return placements.map((p) => byId.get(p.id) ?? p);
}
