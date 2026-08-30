import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  DEFAULT_GLOBALS,
  formatLength,
  inToMm,
  isUsableContainer,
  isUsableTool,
  mmToIn,
  nextId,
  validateLayout,
  type Tool,
  type ToolCategory,
} from "../src/core";
import { CONTAINERS, STARTER_TOOLS } from "../src/data";
import { useDesignStore, useEffectiveContainer } from "./src/store";
import { exportAndShareSTL } from "./src/export";
import { openProjectFile, saveProjectFile } from "./src/projectFile";
import { ArrangeCanvas } from "./src/ArrangeCanvas";
import {
  Btn,
  C,
  Card,
  Note,
  NumberField,
  Row,
  SectionTitle,
  Segmented,
  TextField,
} from "./src/ui";

type Tab = "container" | "tools" | "arrange";

const CATEGORIES: ToolCategory[] = [
  "drill",
  "driver",
  "impact",
  "saw",
  "hand-tool",
  "meter",
  "accessory",
  "other",
];

function numStr(mm: number | null, unit: "mm" | "in"): string {
  if (mm == null) return "";
  return unit === "in" ? mmToIn(mm).toFixed(3) : mm.toFixed(1);
}
function toMm(raw: string, unit: "mm" | "in"): number | null {
  const v = parseFloat(raw.trim());
  if (!isFinite(v) || v <= 0) return null;
  return unit === "in" ? inToMm(v) : v;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("container");
  const project = useDesignStore((s) => s.project);
  const unit = useDesignStore((s) => s.displayUnit);
  const setUnit = useDesignStore((s) => s.setUnit);
  const container = useEffectiveContainer();
  const usable = container && isUsableContainer(container) ? container : null;

  const validation = useMemo(
    () => (usable ? validateLayout(project, usable) : null),
    [project, usable],
  );

  async function onExport() {
    if (!usable) {
      Alert.alert("Measure the cavity first", "The container needs internal W/D/H before export.");
      return;
    }
    try {
      const out = await exportAndShareSTL(project, usable);
      Alert.alert(
        "STL generated",
        `${out.triangleCount.toLocaleString()} triangles · insert ${out.height_mm.toFixed(1)} mm tall` +
          (out.notes.length ? `\n\n${out.notes.join("\n")}` : "") +
          (out.shared ? "" : `\n\nSaved to:\n${out.uri}`),
      );
    } catch (err) {
      Alert.alert("Export failed", String((err as Error)?.message ?? err));
    }
  }

  const errorCount = validation?.errorCount ?? 0;
  const canExport = !!usable && errorCount === 0 && project.placements.length > 0;

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar style="dark" />
      <View style={st.header}>
        <Text style={st.title}>PACKOUT Designer</Text>
        <Segmented<"mm" | "in">
          options={[
            { value: "in", label: "in" },
            { value: "mm", label: "mm" },
          ]}
          value={unit}
          onChange={setUnit}
        />
      </View>

      <View style={st.tabs}>
        <Segmented<Tab>
          options={[
            { value: "container", label: "Container" },
            { value: "tools", label: "Tools" },
            { value: "arrange", label: "Arrange" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
        {tab === "container" && <ContainerPanel />}
        {tab === "tools" && <ToolsPanel />}
        {tab === "arrange" && <ArrangePanel />}
      </ScrollView>

      <View style={st.exportBar}>
        {usable && !usable.verified && (
          <Text style={st.exportWarn}>Cavity unverified — check the fit before printing.</Text>
        )}
        {usable && errorCount > 0 && (
          <Text style={st.exportWarn}>{errorCount} fit error(s) — resolve on the Arrange tab.</Text>
        )}
        <Btn
          label="Export STL"
          kind="primary"
          onPress={onExport}
          disabled={!canExport}
          style={{ width: "100%" }}
        />
      </View>
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------------- container */

function ContainerPanel() {
  const project = useDesignStore((s) => s.project);
  const setContainer = useDesignStore((s) => s.setContainer);
  const setName = useDesignStore((s) => s.setName);
  const loadProject = useDesignStore((s) => s.loadProject);
  const unit = useDesignStore((s) => s.displayUnit);
  const ov = useDesignStore((s) => s.containerOverrides[project.containerId]);
  const setOverride = useDesignStore((s) => s.setContainerOverride);
  const updateGlobals = useDesignStore((s) => s.updateGlobals);
  const container = useEffectiveContainer();
  if (!container) return null;
  const measured = isUsableContainer(container);
  const g = project.global;

  async function onOpen() {
    try {
      const p = await openProjectFile();
      if (p) loadProject(p);
    } catch (err) {
      Alert.alert("Couldn't open that file", String((err as Error)?.message ?? err));
    }
  }

  return (
    <View>
      <SectionTitle>Project</SectionTitle>
      <Card>
        <TextField label="Name" value={project.name} onChangeText={setName} />
        <Row style={{ gap: 8 }}>
          <Btn label="Save / share" onPress={() => void saveProjectFile(project)} style={{ flex: 1 }} />
          <Btn label="Open…" onPress={onOpen} style={{ flex: 1 }} />
        </Row>
      </Card>

      <SectionTitle>Container</SectionTitle>
      <Card>
        {CONTAINERS.map((c) => {
          const on = c.id === project.containerId;
          return (
            <Pressable key={c.id} onPress={() => setContainer(c.id)} style={st.choice}>
              <View style={[st.radio, on && { borderColor: C.accent }]}>
                {on && <View style={st.radioDot} />}
              </View>
              <Text style={[st.choiceText, on && { fontWeight: "700" }]}>
                {c.name}
                {c.modelNumbers[0] ? `  (${c.modelNumbers[0]})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      <Note tone={measured ? "muted" : "warn"}>
        {measured
          ? container.verified
            ? "Cavity confirmed."
            : "Cavity has numbers but is not verified — confirm with calipers before printing."
          : "Cavity not fully specified. Enter internal W / D / H to start."}
      </Note>
      {!!container.source && <Note>source: {container.source}</Note>}

      <SectionTitle>Internal cavity ({unit})</SectionTitle>
      <Card>
        <NumberField
          label="Width (x)"
          value={numStr(container.internal.x_mm, unit)}
          onCommit={(r) => setOverride(project.containerId, { x_mm: toMm(r, unit) })}
        />
        <NumberField
          label="Depth (y)"
          value={numStr(container.internal.y_mm, unit)}
          onCommit={(r) => setOverride(project.containerId, { y_mm: toMm(r, unit) })}
        />
        <NumberField
          label="Height (z)"
          value={numStr(container.internal.z_mm, unit)}
          onCommit={(r) => setOverride(project.containerId, { z_mm: toMm(r, unit) })}
        />
        <Pressable
          onPress={() => setOverride(project.containerId, { verified: !(ov?.verified ?? false) })}
          style={st.choice}
        >
          <View style={[st.checkbox, (ov?.verified ?? false) && { backgroundColor: C.accent }]} />
          <Text style={st.choiceText}>I measured this cavity myself</Text>
        </Pressable>
      </Card>

      <SectionTitle>Global parameters ({unit})</SectionTitle>
      <Card>
        <NumberField
          label="Base thickness"
          value={numStr(g.baseThickness_mm, unit)}
          onCommit={(r) => {
            const v = toMm(r, unit);
            if (v != null) updateGlobals({ baseThickness_mm: v });
          }}
        />
        <NumberField
          label="Edge clearance"
          value={numStr(g.edgeClearance_mm, unit)}
          onCommit={(r) => {
            const v = toMm(r, unit);
            if (v != null) updateGlobals({ edgeClearance_mm: v });
          }}
        />
        <NumberField
          label="Min wall"
          value={numStr(g.minWall_mm, unit)}
          onCommit={(r) => {
            const v = toMm(r, unit);
            if (v != null) updateGlobals({ minWall_mm: v });
          }}
        />
        <NumberField
          label="Lid clearance"
          value={numStr(g.lidClearance_mm, unit)}
          onCommit={(r) => {
            const v = toMm(r, unit);
            if (v != null) updateGlobals({ lidClearance_mm: v });
          }}
        />
        <NumberField
          label="Default tool clearance"
          value={numStr(g.defaultClearance_mm, unit)}
          onCommit={(r) => {
            const v = toMm(r, unit);
            if (v != null) updateGlobals({ defaultClearance_mm: v });
          }}
        />
        <Btn
          label="Reset globals"
          kind="ghost"
          onPress={() => updateGlobals({ ...DEFAULT_GLOBALS })}
        />
      </Card>
    </View>
  );
}

/* ---------------------------------------------------------------- tools */

function ToolsPanel() {
  const project = useDesignStore((s) => s.project);
  const addAndPlaceTool = useDesignStore((s) => s.addAndPlaceTool);
  const placeTool = useDesignStore((s) => s.placeTool);
  const removeTool = useDesignStore((s) => s.removeTool);
  const unit = useDesignStore((s) => s.displayUnit);
  const [showForm, setShowForm] = useState(false);

  const inProject = new Set(project.tools.map((t) => t.id));
  const starterAvail = STARTER_TOOLS.filter((t) => !inProject.has(t.id));

  return (
    <View>
      <SectionTitle>In this project</SectionTitle>
      <Card>
        {project.tools.length === 0 && <Note>No tools yet. Add from the starter set or measure one.</Note>}
        {project.tools.map((t) => {
          const ok = isUsableTool(t);
          return (
            <View key={t.id} style={st.toolRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.toolName}>{t.name}</Text>
                <Text style={st.toolDims}>
                  {ok
                    ? `${formatLength(t.bbox_mm.l!, unit)} · ${formatLength(t.bbox_mm.w!, unit)} · ${formatLength(t.bbox_mm.h!, unit)}`
                    : "needs L · W · H"}
                </Text>
              </View>
              <Btn label="Place" kind="ghost" disabled={!ok} onPress={() => placeTool(t.id)} />
              <Btn label="Remove" kind="ghost" onPress={() => removeTool(t.id)} />
            </View>
          );
        })}
      </Card>

      <SectionTitle>Starter library</SectionTitle>
      <Card>
        {starterAvail.length === 0 && <Note>All starter tools added.</Note>}
        {starterAvail.map((t) => (
          <View key={t.id} style={st.toolRow}>
            <Text style={[st.toolName, { flex: 1 }]}>{t.name}</Text>
            <Btn label="Add" kind="ghost" onPress={() => addAndPlaceTool(t)} />
          </View>
        ))}
      </Card>

      <Btn
        label={showForm ? "Cancel" : "Measure a new tool"}
        onPress={() => setShowForm((v) => !v)}
      />
      {showForm && (
        <MeasureForm
          onAdd={(t) => {
            addAndPlaceTool(t);
            setShowForm(false);
          }}
        />
      )}
    </View>
  );
}

function MeasureForm({ onAdd }: { onAdd: (t: Tool) => void }) {
  const unit = useDesignStore((s) => s.displayUnit);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [cat, setCat] = useState<ToolCategory>("other");
  const [l, setL] = useState("");
  const [w, setW] = useState("");
  const [h, setH] = useState("");

  const lMm = toMm(l, unit);
  const wMm = toMm(w, unit);
  const hMm = toMm(h, unit);
  const ready = name.trim().length > 0 && lMm != null && wMm != null && hMm != null;

  return (
    <Card>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. M12 ratchet" />
      <TextField label="Brand" value={brand} onChangeText={setBrand} placeholder="optional" />
      <Text style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <Row>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCat(c)}
              style={[st.chip, c === cat && { backgroundColor: C.accent, borderColor: C.accent }]}
            >
              <Text style={[st.chipText, c === cat && { color: "#fff" }]}>{c}</Text>
            </Pressable>
          ))}
        </Row>
      </ScrollView>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}>
          <NumberField label={`Length (${unit})`} value={l} onCommit={setL} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label={`Width (${unit})`} value={w} onCommit={setW} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label={`Height (${unit})`} value={h} onCommit={setH} />
        </View>
      </Row>
      <Btn
        label="Add tool"
        kind="primary"
        disabled={!ready}
        onPress={() => {
          if (!ready) return;
          const tool: Tool = {
            id: nextId(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tool"),
            name: name.trim(),
            brand: brand.trim(),
            modelNumbers: [],
            category: cat,
            bbox_mm: { l: lMm!, w: wMm!, h: hMm! },
            outline: null,
            pocket: { style: "bbox", clearance_mm: 1, depth_mm: null, fingerScoop: true },
            verified: true,
            source: "user-measured",
            notes: "",
          };
          onAdd(tool);
        }}
      />
    </Card>
  );
}

/* ---------------------------------------------------------------- arrange */

function ArrangePanel() {
  const project = useDesignStore((s) => s.project);
  const selectedId = useDesignStore((s) => s.selectedPlacementId);
  const rotate = useDesignStore((s) => s.rotatePlacement);
  const remove = useDesignStore((s) => s.removePlacement);
  const autoArrangeAll = useDesignStore((s) => s.autoArrangeAll);
  const container = useEffectiveContainer();
  const usable = container && isUsableContainer(container) ? container : null;
  const validation = useMemo(
    () => (usable ? validateLayout(project, usable) : null),
    [project, usable],
  );
  const sel = project.placements.find((p) => p.id === selectedId);
  const [view, setView] = useState<"realistic" | "schematic">("realistic");

  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: 10 }}>
        <Segmented<"realistic" | "schematic">
          options={[
            { value: "realistic", label: "Realistic" },
            { value: "schematic", label: "Schematic" },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      <ArrangeCanvas mode={view} />

      <Row style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
        <Btn label="Auto-arrange" onPress={autoArrangeAll} />
        <Btn
          label="Rotate 90°"
          onPress={() => sel && rotate(sel.id, sel.rot_deg + 90)}
          disabled={!sel}
        />
        <Btn
          label="Delete"
          kind="danger"
          onPress={() => sel && remove(sel.id)}
          disabled={!sel}
        />
      </Row>

      {sel && <PocketPanel placementId={sel.id} />}

      <SectionTitle>
        Verify{" "}
        {validation
          ? `— ${validation.errorCount} error(s), ${validation.warningCount} warning(s)`
          : ""}
      </SectionTitle>
      <Card>
        {!validation && <Note tone="warn">Measure the container cavity to run fit checks.</Note>}
        {validation && validation.issues.length === 0 && <Note tone="ok">All checks pass.</Note>}
        {validation?.issues.map((i, idx) => (
          <Text
            key={idx}
            style={[st.issue, { color: i.severity === "error" ? C.bad : C.warn }]}
          >
            • {i.message}
          </Text>
        ))}
      </Card>
    </View>
  );
}

function PocketPanel({ placementId }: { placementId: string }) {
  const project = useDesignStore((s) => s.project);
  const unit = useDesignStore((s) => s.displayUnit);
  const setOverride = useDesignStore((s) => s.updatePlacementOverride);
  const pl = project.placements.find((p) => p.id === placementId);
  const tool = pl ? project.tools.find((t) => t.id === pl.toolId) : undefined;
  if (!pl || !tool) return null;

  const clearance = pl.overrides.clearance_mm ?? tool.pocket.clearance_mm;
  const depth = pl.overrides.depth_mm ?? tool.pocket.depth_mm;
  const scoop = pl.overrides.fingerScoop ?? tool.pocket.fingerScoop;

  return (
    <>
      <SectionTitle>Selected pocket — {tool.name}</SectionTitle>
      <Card>
        <Row style={{ gap: 8 }}>
          <View style={{ flex: 1 }}>
            <NumberField
              label={`Clearance (${unit})`}
              value={numStr(clearance, unit)}
              onCommit={(r) => setOverride(placementId, { clearance_mm: toMm(r, unit) ?? undefined })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField
              label={`Depth (${unit}) — blank = auto`}
              value={numStr(depth, unit)}
              onCommit={(r) => setOverride(placementId, { depth_mm: toMm(r, unit) ?? undefined })}
            />
          </View>
        </Row>
        <Pressable
          onPress={() => setOverride(placementId, { fingerScoop: !scoop })}
          style={st.choice}
        >
          <View style={[st.checkbox, scoop && { backgroundColor: C.accent }]} />
          <Text style={st.choiceText}>Finger scoop</Text>
        </Pressable>
        <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
          Position {numStr(pl.x_mm, unit)} , {numStr(pl.y_mm, unit)} · rotation{" "}
          {(((pl.rot_deg % 360) + 360) % 360).toFixed(0)}°
        </Text>
      </Card>
    </>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  title: { fontSize: 17, fontWeight: "700", color: C.ink },
  tabs: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  body: { flex: 1 },
  exportBar: {
    padding: 12,
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  exportWarn: { color: C.warn, fontSize: 12, marginBottom: 6, textAlign: "center" },
  choice: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: 10 },
  choiceText: { fontSize: 14, color: C.ink, flexShrink: 1 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: C.line },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    gap: 4,
  },
  toolName: { fontSize: 14, color: C.ink },
  toolDims: { fontSize: 11, color: C.muted, marginTop: 2 },
  chip: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, color: C.ink },
  issue: { fontSize: 12, lineHeight: 18, marginVertical: 2 },
});
