import { z } from "zod";
import type { Project } from "./types";
import { DEFAULT_GLOBALS } from "./types";

const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });

const nullableLength = z.number().positive().nullable();

export const containerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  modelNumbers: z.array(z.string()).default([]),
  family: z.enum(["organizer", "toolbox", "drawer", "crate", "bin"]),
  exterior_mm: vec3.optional(),
  internal: z.object({
    x_mm: nullableLength,
    y_mm: nullableLength,
    z_mm: nullableLength,
  }),
  features: z.object({
    hasRemovableBins: z.boolean(),
    floorProfile: z.enum(["flat", "ribbed", "recessed"]),
    cornerRadius_mm: z.number().nonnegative().nullable(),
  }),
  verified: z.boolean(),
  source: z.string(),
  notes: z.string(),
});

export const containerLibrarySchema = z.object({
  schema: z.literal(1),
  containers: z.array(containerSchema),
});

export const pocketSpecSchema = z.object({
  style: z.enum(["bbox", "outline", "cylinder"]),
  clearance_mm: z.number().nonnegative(),
  depth_mm: z.number().positive().nullable(),
  fingerScoop: z.boolean(),
});

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default(""),
  modelNumbers: z.array(z.string()).default([]),
  category: z.enum([
    "drill",
    "driver",
    "impact",
    "saw",
    "hand-tool",
    "meter",
    "accessory",
    "other",
  ]),
  bbox_mm: z.object({ l: nullableLength, w: nullableLength, h: nullableLength }),
  outline: z.array(z.tuple([z.number(), z.number()])).nullable().default(null),
  pocket: pocketSpecSchema,
  verified: z.boolean().default(false),
  source: z.string().default(""),
  notes: z.string().default(""),
});

export const toolLibrarySchema = z.object({
  schema: z.literal(1),
  tools: z.array(toolSchema),
});

const globalParamsSchema = z.object({
  baseThickness_mm: z.number().positive(),
  edgeClearance_mm: z.number().nonnegative(),
  minWall_mm: z.number().positive(),
  defaultClearance_mm: z.number().nonnegative(),
  lidClearance_mm: z.number().nonnegative().default(DEFAULT_GLOBALS.lidClearance_mm),
});

const placementSchema = z.object({
  id: z.string().min(1),
  toolId: z.string().min(1),
  x_mm: z.number(),
  y_mm: z.number(),
  rot_deg: z.number(),
  overrides: z
    .object({
      clearance_mm: z.number().nonnegative().optional(),
      depth_mm: z.number().positive().optional(),
      fingerScoop: z.boolean().optional(),
    })
    .default({}),
});

export const projectSchema = z.object({
  schema: z.literal(1),
  name: z.string().min(1),
  containerId: z.string().min(1),
  units: z.literal("mm"),
  global: globalParamsSchema,
  tools: z.array(toolSchema).default([]),
  placements: z.array(placementSchema).default([]),
});

export function parseProject(raw: unknown): Project {
  return projectSchema.parse(raw) as Project;
}

export function safeParseProject(raw: unknown) {
  return projectSchema.safeParse(raw);
}
