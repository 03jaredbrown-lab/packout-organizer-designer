import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DisplayUnit } from "../model/units";
import type { Container, GlobalParams, Placement, Project, Tool } from "../model/types";
import { createProject } from "../model/project";
import {
  addAndPlaceTool as opAddAndPlaceTool,
  arrangeProject as opArrangeProject,
  mergeContainer,
  mergeOverride,
  patchPlacement,
  placeTool as opPlaceTool,
  removeTool as opRemoveTool,
  updateGlobals as opUpdateGlobals,
  type ContainerOverride,
} from "../layout/designOps";
import { CONTAINERS, findContainer } from "../data";

// Re-exported for backwards compatibility with earlier imports.
export type { ContainerOverride } from "../layout/designOps";
export { mergeContainer } from "../layout/designOps";

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

function effectiveContainer(
  containerId: string,
  overrides: Record<string, ContainerOverride>,
): Container | undefined {
  const base = findContainer(containerId);
  return base ? mergeContainer(base, overrides[containerId]) : undefined;
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set) => ({
      project: createProject(firstUsableContainerId, "My PACKOUT layout"),
      displayUnit: "in",
      selectedPlacementId: null,
      containerOverrides: {},

      setContainerOverride: (id, patch) =>
        set((s) => ({
          containerOverrides: {
            ...s.containerOverrides,
            [id]: mergeOverride(s.containerOverrides[id], patch),
          },
        })),

      newProject: (containerId, name) =>
        set({ project: createProject(containerId, name), selectedPlacementId: null }),

      loadProject: (project) => set({ project, selectedPlacementId: null }),

      setName: (name) => set((s) => ({ project: { ...s.project, name } })),

      setContainer: (containerId) => set((s) => ({ project: { ...s.project, containerId } })),

      setUnit: (displayUnit) => set({ displayUnit }),

      updateGlobals: (patch) =>
        set((s) => ({ project: opUpdateGlobals(s.project, patch) })),

      addTool: (tool) =>
        set((s) => ({
          project: s.project.tools.some((t) => t.id === tool.id)
            ? s.project
            : { ...s.project, tools: [...s.project.tools, tool] },
        })),

      updateTool: (toolId, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            tools: s.project.tools.map((t) => (t.id === toolId ? { ...t, ...patch } : t)),
          },
        })),

      removeTool: (toolId) => set((s) => ({ project: opRemoveTool(s.project, toolId) })),

      placeTool: (toolId) =>
        set((s) => {
          const { project, placementId } = opPlaceTool(s.project, toolId);
          return { project, selectedPlacementId: placementId };
        }),

      addAndPlaceTool: (tool) =>
        set((s) => ({
          project: opAddAndPlaceTool(
            s.project,
            tool,
            effectiveContainer(s.project.containerId, s.containerOverrides),
          ),
        })),

      autoArrangeAll: () =>
        set((s) => ({
          project: opArrangeProject(
            s.project,
            effectiveContainer(s.project.containerId, s.containerOverrides),
          ),
        })),

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

/** Hook: the effective (override-merged) container for the current project. */
export function useEffectiveContainer(): Container | undefined {
  const containerId = useDesignStore((s) => s.project.containerId);
  const ov = useDesignStore((s) => s.containerOverrides[containerId]);
  const base = findContainer(containerId);
  return base ? mergeContainer(base, ov) : undefined;
}
