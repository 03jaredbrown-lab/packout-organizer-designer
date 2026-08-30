import { parseProject } from "./schema";
import { DEFAULT_GLOBALS, type Project, type Tool } from "./types";

export function createProject(containerId: string, name = "Untitled layout"): Project {
  return {
    schema: 1,
    name,
    containerId,
    units: "mm",
    global: { ...DEFAULT_GLOBALS },
    tools: [],
    placements: [],
  };
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function loadProjectFromJSON(text: string): Project {
  return parseProject(JSON.parse(text));
}

let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/** Add a tool to the project's embedded library if it is not already present (by id). */
export function ensureTool(project: Project, tool: Tool): Project {
  if (project.tools.some((t) => t.id === tool.id)) return project;
  return { ...project, tools: [...project.tools, tool] };
}
