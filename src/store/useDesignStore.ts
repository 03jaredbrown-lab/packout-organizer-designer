import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DisplayUnit } from "../model/units";
import type { Container, GlobalParams, Placement, Project, Tool } from "../model/types";
import { isUsableContainer, isUsableTool } from "../model/types";
import { createProject, ensureTool, nextId } from "../model/project";
import { autoArrange } from "../layout/autoArrange";
import { insertFootprint } from "../layout/pockets";
import { CONTAINERS, findContainer } from "../data";

export interface ContainerOverride {
  x_mm: number | null;
  y_mm: number | null;
  z_mm: number | null;
  verified: boolean;
}

interface DesignState {
  project: Project;
  displayUnit: DisplayUnit;
  selectedPlacementId: string | null;
  /** User-entered cavity measurements, keyed by container id. Persisted across sessions. */
  containerOverrides: Record<string, ContainerOverride>;
  setContainerOverride: (id: string, patch: Partial<ContainerOverride>) => void;

  newProject: (containerId: string, name?: string) => void;
  loadProject: (project: Project) => void;
  setName: (name: string) => void;
  setContainer: (containerId: string) => void;
  setUnit: (unit: DisplayUnit) => void;
  updateGlobals: (patch: Partial<GlobalParams>) => void;

  addTool: (tool: Tool) => void;
  updateTool: (toolId: string, patch: Partial<Tool>) => void;
  removeTool: (toolId: string) => void;

  placeTool: (toolId: string) => void;
  addAndPlaceTool: (tool: Tool) => void;
  autoArrangeAll: () => void;
  movePlacement: (id: string, x_mm: number, y_mm: number) => void;
  nudgePlacement: (id: string, dx: number, dy: number) => void;
  rotatePlacement: (id: string, rot_deg: number) => void;
  updatePlacementOverride: (id: string, patch: Placement["overrides"]) => void;
  removePlacement: (id: string) => void;
  select: (id: string | null) => void;
}

const firstUsableContainerId =
  CONTAINERS.find((c) => c.internal.x_mm != null)?.id ?? CONTAINERS[0]?.id ?? "organizer";

function patchPlacement(project: Project, id: string, fn: (p: Placement) => Placement): Project {
  return {
    ...project,
    placements: project.placements.map((p) => (p.id === id ? fn(p) : p)),
  };
}

function arrangeProject(
  project: Project,
  overrides: Record<string, ContainerOverride>,
): Project {
  const base = findContainer(project.containerId);
  if (!base) return project;
  const container = mergeContainer(base, overrides[project.containerId]);
  if (!isUsableContainer(container)) return project;
  const footprint = insertFootprint(container, project.global);
  return {
    ...project,
    placements: autoArrange(project.placements, project.tools, footprint, project.global),
  };
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set) => ({
      project: createProject(firstUsableContainerId, "My PACKOUT layout"),
      displayUnit: "in",
      selectedPlacementId: null,
      containerOverrides: {},

      setContainerOverride: (id, patch) =>
        set((s) => {
          const prev: ContainerOverride = s.containerOverrides[id] ?? {
            x_mm: null,
            y_mm: null,
            z_mm: null,
            verified: false,
          };
          return {
            containerOverrides: { ...s.containerOverrides, [id]: { ...prev, ...patch } },
          };
        }),

      newProject: (containerId, name) =>
        set({ project: createProject(containerId, name), selectedPlacementId: null }),

      loadProject: (project) => set({ project, selectedPlacementId: null }),

      setName: (name) => set((s) => ({ project: { ...s.project, name } })),

      setContainer: (containerId) =>
        set((s) => ({ project: { ...s.project, containerId } })),

      setUnit: (displayUnit) => set({ displayUnit }),

      updateGlobals: (patch) =>
        set((s) => ({ project: { ...s.project, global: { ...s.project.global, ...patch } } })),

      addTool: (tool) => set((s) => ({ project: ensureTool(s.project, tool) })),

      updateTool: (toolId, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            tools: s.project.tools.map((t) => (t.id === toolId ? { ...t, ...patch } : t)),
          },
        })),

      removeTool: (toolId) =>
        set((s) => ({
          project: {
            ...s.project,
            tools: s.project.tools.filter((t) => t.id !== toolId),
            placements: s.project.placements.filter((p) => p.toolId !== toolId),
          },
        })),

      placeTool: (toolId) =>
        set((s) => {
          const n = s.project.placements.filter((p) => p.toolId === toolId).length;
          const placement: Placement = {
            id: nextId("p"),
            toolId,
            x_mm: 15 + n * 8,
            y_mm: 15 + n * 8,
            rot_deg: 0,
            overrides: {},
          };
          return {
            project: { ...s.project, placements: [...s.project.placements, placement] },
            selectedPlacementId: placement.id,
          };
        }),

      addAndPlaceTool: (tool) =>
        set((s) => {
          let project = ensureTool(s.project, tool);
          if (isUsableTool(tool) && !project.placements.some((p) => p.toolId === tool.id)) {
            const placement: Placement = {
              id: nextId("p"),
              toolId: tool.id,
              x_mm: 15,
              y_mm: 15,
              rot_deg: 0,
              overrides: {},
            };
            project = { ...project, placements: [...project.placements, placement] };
          }
          project = arrangeProject(project, s.containerOverrides);
          return { project };
        }),

      autoArrangeAll: () =>
        set((s) => ({ project: arrangeProject(s.project, s.containerOverrides) })),

      movePlacement: (id, x_mm, y_mm) =>
        set((s) => ({ project: patchPlacement(s.project, id, (p) => ({ ...p, x_mm, y_mm })) })),

      nudgePlacement: (id, dx, dy) =>
        set((s) => ({
          project: patchPlacement(s.project, id, (p) => ({
            ...p,
            x_mm: p.x_mm + dx,
            y_mm: p.y_mm + dy,
          })),
        })),

      rotatePlacement: (id, rot_deg) =>
        set((s) => ({
          project: patchPlacement(s.project, id, (p) => ({ ...p, rot_deg: rot_deg % 360 })),
        })),

      updatePlacementOverride: (id, patch) =>
        set((s) => ({
          project: patchPlacement(s.project, id, (p) => ({
            ...p,
            overrides: { ...p.overrides, ...patch },
          })),
        })),

      removePlacement: (id) =>
        set((s) => ({
          project: { ...s.project, placements: s.project.placements.filter((p) => p.id !== id) },
          selectedPlacementId: null,
        })),

      select: (id) => set({ selectedPlacementId: id }),
    }),
    {
      name: "packout-designer:v1",
      partialize: (s) => ({
        project: s.project,
        displayUnit: s.displayUnit,
        containerOverrides: s.containerOverrides,
      }),
    },
  ),
);

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

/** Hook: the effective (override-merged) container for the current project. */
export function useEffectiveContainer(): Container | undefined {
  const containerId = useDesignStore((s) => s.project.containerId);
  const ov = useDesignStore((s) => s.containerOverrides[containerId]);
  const base = findContainer(containerId);
  return base ? mergeContainer(base, ov) : undefined;
}
