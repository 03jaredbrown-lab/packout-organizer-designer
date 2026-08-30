// NOTE: on Expo SDK 53+ the classic file API moved — change this to
//   import * as FileSystem from "expo-file-system/legacy";
// (or migrate to the new File/Paths API). SDK 52 keeps it on the main export.
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { exportInsertSTL, type Project, type UsableContainer } from "../../src/core";
import { toBase64 } from "./polyfills";

function safeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "layout"
  );
}

export interface ExportOutcome {
  triangleCount: number;
  height_mm: number;
  notes: string[];
  uri: string;
  shared: boolean;
}

/**
 * Generate the insert STL on-device (no server) and hand it to the iOS share
 * sheet so the user can mail / AirDrop / save it. `container` must have a full
 * cavity — callers gate on validation first.
 */
export async function exportAndShareSTL(
  project: Project,
  container: UsableContainer,
): Promise<ExportOutcome> {
  const { bytes, result } = exportInsertSTL(project, container);
  const uri = `${FileSystem.cacheDirectory ?? ""}${safeName(project.name)}.stl`;
  await FileSystem.writeAsStringAsync(uri, toBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "model/stl",
      dialogTitle: "Export insert STL",
      UTI: "public.standard-tesselated-geometry-format",
    });
    shared = true;
  }

  return {
    triangleCount: result.triangleCount,
    height_mm: result.height_mm,
    notes: result.notes,
    uri,
    shared,
  };
}
