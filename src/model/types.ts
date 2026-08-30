/**
 * Core domain types. Lengths are millimetres. Layout coordinate origin is the
 * top-left inner corner of the container cavity, looking straight down:
 * x grows right, y grows toward the viewer, z grows up out of the floor.
 */

export type ContainerFamily = "organizer" | "toolbox" | "drawer" | "crate" | "bin";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Container {
  id: string;
  name: string;
  modelNumbers: string[];
  family: ContainerFamily;
  exterior_mm?: Vec3;
  /** Usable cavity. Any axis may be null when it has not been measured yet. */
  internal: {
    x_mm: number | null;
    y_mm: number | null;
    z_mm: number | null;
  };
  features: {
    hasRemovableBins: boolean;
    floorProfile: "flat" | "ribbed" | "recessed";
    cornerRadius_mm: number | null;
  };
  verified: boolean;
  source: string;
  notes: string;
}

/** A container whose cavity has been fully specified — safe to design against. */
export interface UsableContainer extends Container {
  internal: { x_mm: number; y_mm: number; z_mm: number };
}

export function isUsableContainer(c: Container): c is UsableContainer {
  return (
    c.internal.x_mm != null &&
    c.internal.y_mm != null &&
    c.internal.z_mm != null &&
    c.internal.x_mm > 0 &&
    c.internal.y_mm > 0 &&
    c.internal.z_mm > 0
  );
}

export type ToolCategory =
  | "drill"
  | "driver"
  | "impact"
  | "saw"
  | "hand-tool"
  | "meter"
  | "accessory"
  | "other";

export type PocketStyle = "bbox" | "outline" | "cylinder";

export interface PocketSpec {
  style: PocketStyle;
  /** Gap added around the tool on every side. */
  clearance_mm: number;
  /** null => auto (a fraction of the tool height). */
  depth_mm: number | null;
  fingerScoop: boolean;
}

export interface Tool {
  id: string;
  name: string;
  brand: string;
  modelNumbers: string[];
  category: ToolCategory;
  bbox_mm: { l: number | null; w: number | null; h: number | null };
  /** Optional tighter footprint polygon in top-down view, millimetres, relative to the bbox top-left. */
  outline: Array<[number, number]> | null;
  pocket: PocketSpec;
  verified: boolean;
  source: string;
  notes: string;
}

/** A tool with a complete bounding box — required before it can be placed. */
export interface UsableTool extends Tool {
  bbox_mm: { l: number; w: number; h: number };
}

export function isUsableTool(t: Tool): t is UsableTool {
  const { l, w, h } = t.bbox_mm;
  return l != null && w != null && h != null && l > 0 && w > 0 && h > 0;
}

export interface GlobalParams {
  baseThickness_mm: number;
  /** Gap between the insert outer wall and the cavity wall. */
  edgeClearance_mm: number;
  /** Minimum material between pockets and between a pocket and the insert edge. */
  minWall_mm: number;
  defaultClearance_mm: number;
  /** Head-room kept under the closed lid above the top of the insert. */
  lidClearance_mm: number;
}

export const DEFAULT_GLOBALS: GlobalParams = {
  baseThickness_mm: 3,
  edgeClearance_mm: 0.5,
  minWall_mm: 1.6,
  defaultClearance_mm: 1,
  lidClearance_mm: 2,
};

export interface Placement {
  id: string;
  toolId: string;
  /** Position of the tool bbox's top-left corner, before rotation. */
  x_mm: number;
  y_mm: number;
  /** Counter-clockwise rotation about the pocket centre, degrees. */
  rot_deg: number;
  overrides: Partial<Pick<PocketSpec, "clearance_mm" | "depth_mm" | "fingerScoop">>;
}

export interface Project {
  schema: 1;
  name: string;
  containerId: string;
  units: "mm";
  global: GlobalParams;
  /** Tools referenced by placements, embedded so a project file is self-contained. */
  tools: Tool[];
  placements: Placement[];
}
