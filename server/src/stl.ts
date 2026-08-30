import {
  exportInsertSTL,
  isUsableContainer,
  mergeContainer,
  safeParseProject,
  validateLayout,
  type ContainerOverride,
  type Issue,
} from "../../src/core";
import { findContainer } from "../../src/data";

export type StlResult =
  | { ok: true; bytes: Uint8Array; filename: string; triangleCount: number; height_mm: number; notes: string[] }
  | { ok: false; status: 400 | 404 | 422; error: string; issues?: Issue[] };

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "insert";
}

/**
 * The whole API in one pure function: parse the project, resolve its container
 * (bundled library + optional user cavity measurements), reject on validation
 * errors, otherwise generate the binary STL. No I/O — callers own the transport.
 */
export function buildStl(body: unknown): StlResult {
  const parsed =
    body && typeof body === "object" && "project" in body ? (body as { project: unknown }).project : body;
  const result = safeParseProject(parsed);
  if (!result.success) {
    return { ok: false, status: 400, error: `Invalid project: ${result.error.message}` };
  }
  const project = result.data;

  const override =
    body && typeof body === "object" && "override" in body
      ? ((body as { override?: Partial<ContainerOverride> }).override ?? undefined)
      : undefined;

  const base = findContainer(project.containerId);
  if (!base) {
    return { ok: false, status: 404, error: `Unknown container "${project.containerId}"` };
  }
  const container = mergeContainer(base, override as ContainerOverride | undefined);
  if (!isUsableContainer(container)) {
    return {
      ok: false,
      status: 422,
      error: `Container "${container.name}" has no complete internal cavity. Send an "override" with x_mm / y_mm / z_mm.`,
    };
  }

  const validation = validateLayout(project, container);
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 422,
      error: `Layout has ${validation.errorCount} fit error(s).`,
      issues: validation.issues.filter((i) => i.severity === "error"),
    };
  }

  const { bytes, result: geom } = exportInsertSTL(project, container);
  return {
    ok: true,
    bytes,
    filename: `${slug(project.name)}.stl`,
    triangleCount: geom.triangleCount,
    height_mm: geom.height_mm,
    notes: geom.notes,
  };
}
