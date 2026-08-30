import type { Mesh } from "./mesh";
import type { Rect } from "../layout/geometry2d";

export interface PocketSolid {
  /** Axis-aligned footprint of the pocket opening, layout mm. */
  bounds: Rect;
  /** Depth measured down from the top face of the insert. */
  depth_mm: number;
  fingerScoop: boolean;
}

export interface InsertRequest {
  /** Outer footprint of the insert (cavity minus edge clearance). */
  footprint: Rect;
  baseThickness_mm: number;
  pockets: PocketSolid[];
}

export interface InsertResult {
  mesh: Mesh;
  height_mm: number;
  triangleCount: number;
  /** Non-fatal notes about approximations the engine made. */
  notes: string[];
}

/**
 * Pluggable geometry backend. v1 ships a rectilinear grid-decomposition engine
 * (no CSG dependency). A manifold/CSG engine can implement the same interface
 * later without touching the UI.
 */
export interface GeometryEngine {
  readonly id: string;
  generateInsert(req: InsertRequest): InsertResult;
}
