import * as DocumentPicker from "expo-document-picker";
// NOTE: on Expo SDK 53+ change to "expo-file-system/legacy" (see export.ts).
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { loadProjectFromJSON, serializeProject, type Project } from "../../src/core";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "layout";
}

/** Write the project to a .packout.json file and open the share sheet. */
export async function saveProjectFile(project: Project): Promise<void> {
  const uri = `${FileSystem.cacheDirectory ?? ""}${slug(project.name)}.packout.json`;
  await FileSystem.writeAsStringAsync(uri, serializeProject(project), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Save / share project" });
  }
}

/** Pick a .packout.json / .json file and parse it. Returns null if the user cancels. */
export async function openProjectFile(): Promise<Project | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "public.json", "*/*"],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return loadProjectFromJSON(text);
}
