/**
 * Pure, framework-free operations on a Project / design state. Both the web
 * Zustand store and the mobile store are thin wrappers over these so the
 * non-trivial reducer logic lives in one place.
 */
import type { Container, GlobalParams, Placement, Project, Tool } from "../model/types";
import { isUsableContainer, isUsableTool } from "../model/types";
import { ensureTool, nextId } from "../model/project";
import { autoArrange } from "./autoArrange";
import { insertFootprint } from "./pockets";

/** User-entered cavity measurements for a container, kept outside the static library. */
export interface ContainerOverride {
  x_mm: number | null;
  y_mm: number | null;
  z_mm: number | null;
  verified: boolean;
}

export const EMPTY_OVERRIDE: ContainerOverride = {
  x_mm: null,
  y_mm: null,
  z_mm: null,
  verified: false,
};

/** Merge a container's shipped data with any user-entered cavity measurements. */
export function mergeContainer(base: Container, ov?: ContainerOverride): Container {
  if (!ov) return base;
  return {
    ...base,
    internal: {
      x_mm: ov.x_mm ?? base.internal.x_mm,
      y_mm: ov.y_mm ?? base.internal.y_mm,
      z_mm: ov.z_mm ?? base.internal.z_mm,
    },
    verified: ov.verified || base.verified,
    source: ov.verified ? `${base.source || "n/a"} + user-measured` : base.source,
  };
}

export function mergeOverride(
  prev: ContainerOverride | undefined,
  patch: Partial<ContainerOverride>,
): ContainerOverride {
  return { ...EMPTY_OVERRIDE, ...prev, ...patch };
}

/** Replace one placement by id. */
export function patchPlacement(
  project: Project,
  id: string,
  fn: (p: Placement) => Placement,
): Project {
  return {
    ...project,
    placements: project.placements.map((p) => (p.id === id ? fn(p) : p)),
  };
}

/** Row-pack every placeable tool into the insert footprint. No-op if the cavity isn't known. */
export function arrangeProject(project: Project, container: Container | undefined): Project {
  if (!container || !isUsableContainer(container)) return project;
  const footprint = insertFootprint(container, project.global);
  return {
    ...project,
    placements: autoArrange(project.placements, project.tools, footprint, project.global),
  };
}

export function newPlacement(
  toolId: string,
  x_mm: number,
  y_mm: number,
  rot_deg = 0,
): Placement {
  return { id: nextId("p"), toolId, x_mm, y_mm, rot_deg, overrides: {} };
}

/** Add a nth pocket for an already-known tool, offset from the previous ones. */
export function placeTool(project: Project, toolId: string): { project: Project; placementId: string } {
  const n = project.placements.filter((p) => p.toolId === toolId).length;
  const placement = newPlacement(toolId, 15 + n * 8, 15 + n * 8);
  return {
    project: { ...project, placements: [...project.placements, placement] },
    placementId: placement.id,
  };
}

/**
 * Add a tool to the project library, drop a pocket for it if it has a full
 * bounding box and isn't placed yet, then re-pack.
 */
export function addAndPlaceTool(
  project: Project,
  tool: Tool,
  container: Container | undefined,
): Project {
  let next = ensureTool(project, tool);
  if (isUsableTool(tool) && !next.placements.some((p) => p.toolId === tool.id)) {
    next = { ...next, placements: [...next.placements, newPlacement(tool.id, 15, 15)] };
  }
  return arrangeProject(next, container);
}

export function updateGlobals(project: Project, patch: Partial<GlobalParams>): Project {
  return { ...project, global: { ...project.global, ...patch } };
}

export function removeTool(project: Project, toolId: string): Project {
  return {
    ...project,
    tools: project.tools.filter((t) => t.id !== toolId),
    placements: project.placements.filter((p) => p.toolId !== toolId),
  };
}
