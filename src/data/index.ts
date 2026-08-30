import containersRaw from "../../data/containers.json";
import starterToolsRaw from "../../data/tools.starter.json";
import { containerLibrarySchema, toolLibrarySchema } from "../model/schema";
import type { Container, Tool } from "../model/types";

/**
 * Static libraries shipped with the app. Parsed through the same schemas as
 * user-loaded files so a malformed edit fails loudly at startup rather than
 * halfway through a design.
 */

export const CONTAINERS: Container[] = containerLibrarySchema.parse(containersRaw)
  .containers as Container[];

export const STARTER_TOOLS: Tool[] = toolLibrarySchema.parse(starterToolsRaw).tools as Tool[];

export function findContainer(id: string): Container | undefined {
  return CONTAINERS.find((c) => c.id === id);
}
