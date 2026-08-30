/**
 * Portable core: the platform-neutral surface of the app.
 *
 * Everything re-exported here lives under `src/model`, `src/layout`, and
 * `src/geometry` and depends only on TypeScript + pure math — no DOM, no React,
 * no `localStorage`, no `Blob`. It runs unchanged in a browser, in Node, in a
 * serverless function, or in a React Native runtime.
 *
 * Keep it that way. A future hosted STL/export API and the planned iOS/Android
 * clients are meant to consume this module (eventually extracted to its own
 * package) rather than reimplement layout validation or geometry. Anything that
 * needs `document`, `window`, `fetch`, a filesystem, or a UI framework belongs
 * in a platform layer (`src/ui`, `src/store`, a backend handler), not here.
 */

// ---- domain model -----------------------------------------------------------
export type {
  Container,
  UsableContainer,
  ContainerFamily,
  Tool,
  UsableTool,
  ToolCategory,
  PocketSpec,
  PocketStyle,
  Placement,
  Project,
  GlobalParams,
  Vec3,
} from "../model/types";
export { isUsableContainer, isUsableTool, DEFAULT_GLOBALS } from "../model/types";

export {
  containerSchema,
  containerLibrarySchema,
  toolSchema,
  toolLibrarySchema,
  pocketSpecSchema,
  projectSchema,
  parseProject,
  safeParseProject,
} from "../model/schema";

export {
  createProject,
  serializeProject,
  loadProjectFromJSON,
  ensureTool,
  nextId,
} from "../model/project";

export {
  MM_PER_INCH,
  mmToIn,
  inToMm,
  formatLength,
  parseLength,
  round,
} from "../model/units";
export type { DisplayUnit } from "../model/units";

// ---- layout + fit validation ---------------------------------------------------
export {
  resolvePocket,
  resolveAllPockets,
  insertFootprint,
  autoDepth,
  resolveClearance,
  resolveDepth,
  resolveFingerScoop,
} from "../layout/pockets";
export type { ResolvedPocket } from "../layout/pockets";

export { validateLayout } from "../layout/validate";
export type { Issue, IssueSeverity, ValidationResult } from "../layout/validate";

export { autoArrange } from "../layout/autoArrange";

// ---- geometry + STL --------------------------------------------------------
export type {
  GeometryEngine,
  InsertRequest,
  InsertResult,
  PocketSolid,
} from "../geometry/GeometryEngine";
export { SlabGeometryEngine } from "../geometry/slabEngine";
export { box, mergeMeshes, serializeBinarySTL, meshBounds, triangleNormal } from "../geometry/mesh";
export type { Mesh, Triangle, V3 } from "../geometry/mesh";
export { buildInsertRequest, generateInsert, exportInsertSTL } from "../geometry/exportInsert";
