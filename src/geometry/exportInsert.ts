import type { Project, UsableContainer } from "../model/types";
import { insertFootprint, resolveAllPockets } from "../layout/pockets";
import { SlabGeometryEngine } from "./slabEngine";
import { serializeBinarySTL } from "./mesh";
import type { InsertRequest, InsertResult } from "./GeometryEngine";

const engine = new SlabGeometryEngine();

export function buildInsertRequest(project: Project, container: UsableContainer): InsertRequest {
  const footprint = insertFootprint(container, project.global);
  const pockets = resolveAllPockets(project).map((pk) => ({
    bounds: pk.bounds,
    depth_mm: pk.depth_mm,
    fingerScoop: pk.fingerScoop,
  }));
  return { footprint, baseThickness_mm: project.global.baseThickness_mm, pockets };
}

export function generateInsert(project: Project, container: UsableContainer): InsertResult {
  return engine.generateInsert(buildInsertRequest(project, container));
}

export function exportInsertSTL(
  project: Project,
  container: UsableContainer,
): { bytes: Uint8Array; result: InsertResult } {
  const result = generateInsert(project, container);
  return { bytes: serializeBinarySTL(result.mesh, project.name.slice(0, 60)), result };
}
