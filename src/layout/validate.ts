import type { Project, UsableContainer } from "../model/types";
import { marginInsideBounds, polygonGap, polygonsOverlap } from "./geometry2d";
import { insertFootprint, resolveAllPockets, type ResolvedPocket } from "./pockets";

export type IssueSeverity = "error" | "warning";

export interface Issue {
  severity: IssueSeverity;
  code:
    | "out-of-bounds"
    | "overlap"
    | "min-wall-neighbour"
    | "min-wall-edge"
    | "too-tall"
    | "pocket-too-deep"
    | "pocket-too-shallow"
    | "unplaceable-tool"
    | "container-unverified"
    | "tool-unverified";
  message: string;
  placementIds: string[];
}

export interface ValidationResult {
  issues: Issue[];
  pockets: ResolvedPocket[];
  ok: boolean;
  errorCount: number;
  warningCount: number;
}

const MIN_PRINTABLE_DEPTH_MM = 3;

export function validateLayout(project: Project, container: UsableContainer): ValidationResult {
  const g = project.global;
  const issues: Issue[] = [];
  const pockets = resolveAllPockets(project);
  const footprint = insertFootprint(container, g);

  if (!container.verified) {
    issues.push({
      severity: "warning",
      code: "container-unverified",
      message: `Container "${container.name}" cavity has not been confirmed by measurement. Do not print an export from it until you have.`,
      placementIds: [],
    });
  }

  // Tools referenced but not placeable / not verified.
  const placedToolIds = new Set(project.placements.map((p) => p.toolId));
  for (const tool of project.tools) {
    if (!placedToolIds.has(tool.id)) continue;
    const { l, w, h } = tool.bbox_mm;
    if (l == null || w == null || h == null) {
      issues.push({
        severity: "error",
        code: "unplaceable-tool",
        message: `"${tool.name}" is missing a length/width/height and cannot form a pocket.`,
        placementIds: project.placements.filter((p) => p.toolId === tool.id).map((p) => p.id),
      });
    } else if (!tool.verified) {
      issues.push({
        severity: "warning",
        code: "tool-unverified",
        message: `"${tool.name}" dimensions are unverified. Measure before printing.`,
        placementIds: project.placements.filter((p) => p.toolId === tool.id).map((p) => p.id),
      });
    }
  }

  // Per-pocket: bounds, edge wall, depth sanity.
  for (const pk of pockets) {
    const margin = marginInsideBounds(pk.footprint, footprint);
    if (margin < 0) {
      issues.push({
        severity: "error",
        code: "out-of-bounds",
        message: `"${pk.toolName}" extends ${Math.abs(margin).toFixed(1)} mm past the usable area.`,
        placementIds: [pk.placementId],
      });
    } else if (margin + 1e-6 < g.minWall_mm) {
      issues.push({
        severity: "warning",
        code: "min-wall-edge",
        message: `"${pk.toolName}" is only ${margin.toFixed(1)} mm from the insert edge (min wall ${g.minWall_mm} mm).`,
        placementIds: [pk.placementId],
      });
    }

    if (pk.depth_mm > pk.toolHeight_mm + 1e-6) {
      issues.push({
        severity: "warning",
        code: "pocket-too-deep",
        message: `"${pk.toolName}" pocket depth ${pk.depth_mm.toFixed(1)} mm is deeper than the tool (${pk.toolHeight_mm.toFixed(1)} mm).`,
        placementIds: [pk.placementId],
      });
    }
    if (pk.depth_mm < MIN_PRINTABLE_DEPTH_MM) {
      issues.push({
        severity: "warning",
        code: "pocket-too-shallow",
        message: `"${pk.toolName}" pocket depth ${pk.depth_mm.toFixed(1)} mm is below the ${MIN_PRINTABLE_DEPTH_MM} mm printable floor.`,
        placementIds: [pk.placementId],
      });
    }
  }

  // Pairwise: overlap and neighbour wall.
  for (let i = 0; i < pockets.length; i++) {
    for (let j = i + 1; j < pockets.length; j++) {
      const a = pockets[i];
      const b = pockets[j];
      if (polygonsOverlap(a.footprint, b.footprint)) {
        issues.push({
          severity: "error",
          code: "overlap",
          message: `"${a.toolName}" and "${b.toolName}" pockets overlap.`,
          placementIds: [a.placementId, b.placementId],
        });
        continue;
      }
      const gap = polygonGap(a.footprint, b.footprint);
      if (gap + 1e-6 < g.minWall_mm) {
        issues.push({
          severity: "warning",
          code: "min-wall-neighbour",
          message: `"${a.toolName}" and "${b.toolName}" pockets are ${gap.toFixed(1)} mm apart (min wall ${g.minWall_mm} mm).`,
          placementIds: [a.placementId, b.placementId],
        });
      }
    }
  }

  // Height: base + deepest pocket must fit under the lid.
  const deepest = pockets.reduce((m, p) => Math.max(m, p.depth_mm), 0);
  const insertHeight = g.baseThickness_mm + deepest;
  const available = container.internal.z_mm - g.lidClearance_mm;
  if (insertHeight > available + 1e-6) {
    issues.push({
      severity: "error",
      code: "too-tall",
      message: `Insert is ${insertHeight.toFixed(1)} mm tall but only ${available.toFixed(1)} mm fits under the lid (cavity ${container.internal.z_mm} mm minus ${g.lidClearance_mm} mm clearance).`,
      placementIds: [],
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  return { issues, pockets, ok: errorCount === 0, errorCount, warningCount };
}
