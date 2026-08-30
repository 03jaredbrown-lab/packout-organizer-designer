/**
 * Mobile design store. Deliberately a close mirror of the web app's
 * src/store/useDesignStore.ts — the reducer logic is the same, only the
 * persistence backend differs (AsyncStorage instead of localStorage). Keep the
 * two in sync until the shared reducer logic is hoisted into the core package.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  autoArrange,
  createProject,
  DEFAULT_GLOBALS,
  ensureTool,
  insertFootprint,
  isUsableContainer,
  isUsableTool,
  nextId,
  type Container,
  type DisplayUnit,
  type GlobalParams,
  type Placement,
  type Project,
  type Tool,
} from "../../src/core";
import { CONTAINERS, findContainer } from "../../src/data";

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
  containerOverrides: Record<string, ContainerOverride>;

  setContainer: (id: string) => void;
  setUnit: (u: DisplayUnit) => void;
  newProject: (containerId: string) => void;
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

function patchPlacement(project: Project, id: string, fn: (p: Placement) => Placement): Project {
  return { ...project, placements: project.placements.map((p) => (p.id === id ? fn(p) : p)) };
}

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

function arrangeProject(project: Project, overrides: Record<string, ContainerOverride>): Project {
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

      setContainer: (id) => set((s) => ({ project: { ...s.project, containerId: id } })),
      setUnit: (displayUnit) => set({ displayUnit }),
      newProject: (containerId) =>
        set({ project: createProject(containerId, "My PACKOUT layout"), selectedPlacementId: null }),

      updateGlobals: (patch) =>
        set((s) => ({ project: { ...s.project, global: { ...s.project.global, ...patch } } })),

      setContainerOverride: (id, patch) =>
        set((s) => {
          const prev: ContainerOverride = s.containerOverrides[id] ?? {
            x_mm: null,
            y_mm: null,
            z_mm: null,
            verified: false,
          };
          return { containerOverrides: { ...s.containerOverrides, [id]: { ...prev, ...patch } } };
        }),

      addAndPlaceTool: (tool) =>
        set((s) => {
          let project = ensureTool(s.project, tool);
          if (isUsableTool(tool) && !project.placements.some((p) => p.toolId === tool.id)) {
            project = {
              ...project,
              placements: [
                ...project.placements,
                { id: nextId("p"), toolId: tool.id, x_mm: 15, y_mm: 15, rot_deg: 0, overrides: {} },
              ],
            };
          }
          return { project: arrangeProject(project, s.containerOverrides) };
        }),

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

      removeTool: (toolId) =>
        set((s) => ({
          project: {
            ...s.project,
            tools: s.project.tools.filter((t) => t.id !== toolId),
            placements: s.project.placements.filter((p) => p.toolId !== toolId),
          },
        })),

      autoArrangeAll: () =>
        set((s) => ({ project: arrangeProject(s.project, s.containerOverrides) })),

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
