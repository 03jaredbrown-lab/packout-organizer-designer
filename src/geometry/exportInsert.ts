import type { Project, UsableContainer } from "../model/types";
import { insertFootprint, resolveAllPockets } from "../layout/pockets";
import { boundingBox } from "../layout/geometry2d";
import { SlabGeometryEngine } from "./slabEngine";
import { serializeBinarySTL } from "./mesh";
import type { InsertRequest, InsertResult, PocketSolid } from "./GeometryEngine";

const engine = new SlabGeometryEngine();

export function buildInsertRequest(project: Project, container: UsableContainer): InsertRequest {
  const footprint = insertFootprint(container, project.global);

  // Carve one box per convex part of the pocket, so a contoured (L-/T-shaped)
  // tool cuts its real silhouette rather than its bounding box. The finger scoop
  // goes on the part reaching furthest in +y (the grip / open end).
  const pockets: PocketSolid[] = resolveAllPockets(project).flatMap((pk) => {
    const parts = pk.footprintParts.map(boundingBox);
    let scoopIdx = 0;
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].y + parts[i].h > parts[scoopIdx].y + parts[scoopIdx].h) scoopIdx = i;
    }
    return parts.map((bounds, i) => ({
      bounds,
      depth_mm: pk.depth_mm,
      fingerScoop: pk.fingerScoop && i === scoopIdx,
    }));
  });

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
