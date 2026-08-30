/**
 * Mobile design store — a thin Zustand + AsyncStorage wrapper over the shared,
 * framework-free design ops in the core (src/layout/designOps.ts). The web store
 * (src/store/useDesignStore.ts) wraps the same ops; only persistence differs.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  addAndPlaceTool as opAddAndPlaceTool,
  arrangeProject as opArrangeProject,
  createProject,
  mergeContainer,
  mergeOverride,
  patchPlacement,
  placeTool as opPlaceTool,
  removeTool as opRemoveTool,
  updateGlobals as opUpdateGlobals,
  type Container,
  type ContainerOverride,
  type DisplayUnit,
  type GlobalParams,
  type Placement,
  type Project,
  type Tool,
} from "../../src/core";
import { CONTAINERS, findContainer } from "../../src/data";

export type { ContainerOverride } from "../../src/core";

interface DesignState {
  project: Project;
  displayUnit: DisplayUnit;
  selectedPlacementId: string | null;
  containerOverrides: Record<string, ContainerOverride>;

  setContainer: (id: string) => void;
  setUnit: (u: DisplayUnit) => void;
  setName: (name: string) => void;
  newProject: (containerId: string) => void;
  loadProject: (project: Project) => void;
  updateGlobals: (patch: Partial<GlobalParams>) => void;
  setContainerOverride: (id: string, patch: Partial<ContainerOverride>) => void;

  addAndPlaceTool: (tool: Tool) => void;
  placeTool: (toolId: string) => void;
  removeTool: (toolId: string) => void;
  autoArrangeAll: () => void;

  movePlacement: (id: string, x_mm: number, y_mm: number) => void;
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

      setContainer: (id) => set((s) => ({ project: { ...s.project, containerId: id } })),
      setUnit: (displayUnit) => set({ displayUnit }),
      setName: (name) => set((s) => ({ project: { ...s.project, name } })),
      newProject: (containerId) =>
        set({ project: createProject(containerId, "My PACKOUT layout"), selectedPlacementId: null }),
      loadProject: (project) => set({ project, selectedPlacementId: null }),

      updateGlobals: (patch) => set((s) => ({ project: opUpdateGlobals(s.project, patch) })),

      setContainerOverride: (id, patch) =>
        set((s) => ({
          containerOverrides: {
            ...s.containerOverrides,
            [id]: mergeOverride(s.containerOverrides[id], patch),
          },
        })),

      addAndPlaceTool: (tool) =>
        set((s) => ({
          project: opAddAndPlaceTool(
            s.project,
            tool,
            effectiveContainer(s.project.containerId, s.containerOverrides),
          ),
        })),

      placeTool: (toolId) =>
        set((s) => {
          const { project, placementId } = opPlaceTool(s.project, toolId);
          return { project, selectedPlacementId: placementId };
        }),

      removeTool: (toolId) => set((s) => ({ project: opRemoveTool(s.project, toolId) })),

      autoArrangeAll: () =>
        set((s) => ({
          project: opArrangeProject(
            s.project,
            effectiveContainer(s.project.containerId, s.containerOverrides),
          ),
        })),

      movePlacement: (id, x_mm, y_mm) =>
        set((s) => ({ project: patchPlacement(s.project, id, (p) => ({ ...p, x_mm, y_mm })) })),

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
      name: "packout-designer-mobile:v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        project: s.project,
        displayUnit: s.displayUnit,
        containerOverrides: s.containerOverrides,
      }),
    },
  ),
);

export function useEffectiveContainer(): Container | undefined {
  const containerId = useDesignStore((s) => s.project.containerId);
  const ov = useDesignStore((s) => s.containerOverrides[containerId]);
  const base = findContainer(containerId);
  return base ? mergeContainer(base, ov) : undefined;
}
