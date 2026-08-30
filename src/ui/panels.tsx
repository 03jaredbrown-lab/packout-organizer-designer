import { useRef, useState } from "react";
import { useDesignStore, useEffectiveContainer } from "../store/useDesignStore";
import { CONTAINERS, STARTER_TOOLS } from "../data";
import { isUsableContainer, isUsableTool, type Tool, type ToolCategory } from "../model/types";
import { formatLength } from "../model/units";
import { serializeProject, loadProjectFromJSON, nextId } from "../model/project";
import { validateLayout } from "../layout/validate";
import { exportInsertSTL } from "../geometry/exportInsert";
import { downloadBlob, slugify } from "./download";
import { MmInput } from "./MmInput";

/* ------------------------------------------------------------------ project bar */

export function ProjectBar() {
  const project = useDesignStore((s) => s.project);
  const setName = useDesignStore((s) => s.setName);
  const unit = useDesignStore((s) => s.displayUnit);
  const setUnit = useDesignStore((s) => s.setUnit);
  const loadProject = useDesignStore((s) => s.loadProject);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function saveProject() {
    downloadBlob(serializeProject(project), `${slugify(project.name)}.packout.json`, "application/json");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadProject(loadProjectFromJSON(await file.text()));
    } catch (err) {
      alert(`Could not load project: ${(err as Error).message}`);
    }
    e.target.value = "";
  }

  return (
    <header className="project-bar">
      <input
        className="project-name"
        value={project.name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Project name"
      />
      <div className="spacer" />
      <div className="unit-toggle">
        <button className={unit === "in" ? "on" : ""} onClick={() => setUnit("in")}>
          in
        </button>
        <button className={unit === "mm" ? "on" : ""} onClick={() => setUnit("mm")}>
          mm
        </button>
      </div>
      <button onClick={saveProject}>Save .json</button>
      <button onClick={() => fileRef.current?.click()}>Load .json</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={onFile}
      />
    </header>
  );
}

/* ------------------------------------------------------------------ container + fit */

export function ContainerPanel() {
  const project = useDesignStore((s) => s.project);
  const setContainer = useDesignStore((s) => s.setContainer);
  const unit = useDesignStore((s) => s.displayUnit);
  const overrides = useDesignStore((s) => s.containerOverrides[project.containerId]);
  const setOverride = useDesignStore((s) => s.setContainerOverride);
  const updateGlobals = useDesignStore((s) => s.updateGlobals);
  const container = useEffectiveContainer();

  if (!container) return <section className="panel">Unknown container.</section>;
  const measured = isUsableContainer(container);

  return (
    <section className="panel">
      <h2>Container &amp; fit</h2>
      <label className="field">
        <span>Container</span>
        <select value={project.containerId} onChange={(e) => setContainer(e.target.value)}>
          {CONTAINERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.modelNumbers.join(", ") || "no SKU"})
            </option>
          ))}
        </select>
      </label>

      <p className={measured ? "note ok" : "note warn"}>
        {measured
          ? container.verified
            ? "Cavity confirmed."
            : "Cavity has numbers but is not verified — confirm with calipers before printing."
          : "Cavity not fully specified. Enter the internal dimensions to start."}
      </p>
      {container.source && <p className="source">source: {container.source}</p>}

      <div className="triple">
        <label>
          <span>Internal W (x)</span>
          <MmInput
            value={container.internal.x_mm}
            unit={unit}
            allowNull
            min={1}
            onCommit={(mm) => setOverride(project.containerId, { x_mm: mm })}
          />
        </label>
        <label>
          <span>Internal D (y)</span>
          <MmInput
            value={container.internal.y_mm}
            unit={unit}
            allowNull
            min={1}
            onCommit={(mm) => setOverride(project.containerId, { y_mm: mm })}
          />
        </label>
        <label>
          <span>Internal H (z)</span>
          <MmInput
            value={container.internal.z_mm}
            unit={unit}
            allowNull
            min={1}
            onCommit={(mm) => setOverride(project.containerId, { z_mm: mm })}
          />
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={overrides?.verified ?? false}
          onChange={(e) => setOverride(project.containerId, { verified: e.target.checked })}
        />
        I measured this cavity myself
      </label>

      <h3>Global parameters</h3>
      <div className="triple">
        <label>
          <span>Base thickness</span>
          <MmInput
            value={project.global.baseThickness_mm}
            unit={unit}
            min={0.4}
            onCommit={(mm) => mm != null && updateGlobals({ baseThickness_mm: mm })}
          />
        </label>
        <label>
          <span>Edge clearance</span>
          <MmInput
            value={project.global.edgeClearance_mm}
            unit={unit}
            min={0}
            onCommit={(mm) => mm != null && updateGlobals({ edgeClearance_mm: mm })}
          />
        </label>
        <label>
          <span>Min wall</span>
          <MmInput
            value={project.global.minWall_mm}
            unit={unit}
            min={0.4}
            onCommit={(mm) => mm != null && updateGlobals({ minWall_mm: mm })}
          />
        </label>
        <label>
          <span>Lid clearance</span>
          <MmInput
            value={project.global.lidClearance_mm}
            unit={unit}
            min={0}
            onCommit={(mm) => mm != null && updateGlobals({ lidClearance_mm: mm })}
          />
        </label>
        <label>
          <span>Default tool clearance</span>
          <MmInput
            value={project.global.defaultClearance_mm}
            unit={unit}
            min={0}
            onCommit={(mm) => mm != null && updateGlobals({ defaultClearance_mm: mm })}
          />
        </label>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ tools */

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

export function ToolLibraryPanel() {
  const project = useDesignStore((s) => s.project);
  const addAndPlaceTool = useDesignStore((s) => s.addAndPlaceTool);
  const placeTool = useDesignStore((s) => s.placeTool);
  const removeTool = useDesignStore((s) => s.removeTool);
  const unit = useDesignStore((s) => s.displayUnit);
  const [showForm, setShowForm] = useState(false);

  const inProject = new Set(project.tools.map((t) => t.id));
  const starterAvailable = STARTER_TOOLS.filter((t) => !inProject.has(t.id));

  return (
    <section className="panel">
      <h2>Tools</h2>

      <h3>In this project</h3>
      {project.tools.length === 0 && <p className="note">No tools yet. Add from the starter set or measure one.</p>}
      <ul className="tool-list">
        {project.tools.map((t) => {
          const usable = isUsableTool(t);
          return (
            <li key={t.id} className={usable ? "" : "incomplete"}>
              <div className="tool-line">
                <span className="tool-name">{t.name}</span>
                <span className="tool-dims">
                  {usable
                    ? `${formatLength(t.bbox_mm.l!, unit)} · ${formatLength(t.bbox_mm.w!, unit)} · ${formatLength(t.bbox_mm.h!, unit)}`
                    : "needs L·W·H"}
                </span>
              </div>
              <div className="tool-actions">
                <button disabled={!usable} onClick={() => placeTool(t.id)}>
                  Place
                </button>
                <button className="link" onClick={() => removeTool(t.id)}>
                  remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <h3>Starter library</h3>
      <ul className="tool-list compact">
        {starterAvailable.map((t) => (
          <li key={t.id}>
            <span className="tool-name">{t.name}</span>
            <button className="link" onClick={() => addAndPlaceTool(t)}>
              add
            </button>
          </li>
        ))}
        {starterAvailable.length === 0 && <li className="note">All starter tools added.</li>}
      </ul>

      <button onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancel" : "Measure a new tool"}
      </button>
      {showForm && <ToolForm onDone={() => setShowForm(false)} />}
    </section>
  );
}

function ToolForm({ onDone }: { onDone: () => void }) {
  const addAndPlaceTool = useDesignStore((s) => s.addAndPlaceTool);
  const unit = useDesignStore((s) => s.displayUnit);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<ToolCategory>("other");
  const [l, setL] = useState<number | null>(null);
  const [w, setW] = useState<number | null>(null);
  const [h, setH] = useState<number | null>(null);

  function submit() {
    if (!name.trim() || l == null || w == null || h == null) return;
    const tool: Tool = {
      id: nextId(slugify(name)),
      name: name.trim(),
      brand: brand.trim(),
      modelNumbers: [],
      category,
      bbox_mm: { l, w, h },
      outline: null,
      pocket: { style: "bbox", clearance_mm: 1, depth_mm: null, fingerScoop: true },
      verified: true,
      source: "user-measured",
      notes: "",
    };
    addAndPlaceTool(tool);
    onDone();
  }

  return (
    <div className="tool-form">
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. M12 ratchet" />
      </label>
      <label className="field">
        <span>Brand</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as ToolCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className="triple">
        <label>
          <span>Length</span>
          <MmInput value={l} unit={unit} allowNull min={1} onCommit={setL} />
        </label>
        <label>
          <span>Width</span>
          <MmInput value={w} unit={unit} allowNull min={1} onCommit={setW} />
        </label>
        <label>
          <span>Height</span>
          <MmInput value={h} unit={unit} allowNull min={1} onCommit={setH} />
        </label>
      </div>
      <button className="primary" disabled={!name.trim() || l == null || w == null || h == null} onClick={submit}>
        Add tool
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ selected pocket */

export function PocketPanel() {
  const project = useDesignStore((s) => s.project);
  const selectedId = useDesignStore((s) => s.selectedPlacementId);
  const unit = useDesignStore((s) => s.displayUnit);
  const rotate = useDesignStore((s) => s.rotatePlacement);
  const move = useDesignStore((s) => s.movePlacement);
  const removePlacement = useDesignStore((s) => s.removePlacement);
  const setOverride = useDesignStore((s) => s.updatePlacementOverride);

  const placement = project.placements.find((p) => p.id === selectedId);
  if (!placement) return <section className="panel muted">Select a pocket to tune it.</section>;
  const tool = project.tools.find((t) => t.id === placement.toolId);

  return (
    <section className="panel">
      <h2>{tool?.name ?? "Pocket"}</h2>
      <div className="row">
        <button onClick={() => rotate(placement.id, placement.rot_deg - 90)}>⟲ 90°</button>
        <button onClick={() => rotate(placement.id, placement.rot_deg + 90)}>⟳ 90°</button>
        <span className="rot">{((placement.rot_deg % 360) + 360) % 360}°</span>
      </div>
      <div className="triple">
        <label>
          <span>X</span>
          <MmInput
            value={placement.x_mm}
            unit={unit}
            onCommit={(mm) => mm != null && move(placement.id, mm, placement.y_mm)}
          />
        </label>
        <label>
          <span>Y</span>
          <MmInput
            value={placement.y_mm}
            unit={unit}
            onCommit={(mm) => mm != null && move(placement.id, placement.x_mm, mm)}
          />
        </label>
      </div>
      <div className="triple">
        <label>
          <span>Clearance</span>
          <MmInput
            value={placement.overrides.clearance_mm ?? tool?.pocket.clearance_mm ?? null}
            unit={unit}
            allowNull
            min={0}
            onCommit={(mm) => setOverride(placement.id, { clearance_mm: mm ?? undefined })}
          />
        </label>
        <label>
          <span>Depth</span>
          <MmInput
            value={placement.overrides.depth_mm ?? tool?.pocket.depth_mm ?? null}
            unit={unit}
            allowNull
            min={1}
            onCommit={(mm) => setOverride(placement.id, { depth_mm: mm ?? undefined })}
          />
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={placement.overrides.fingerScoop ?? tool?.pocket.fingerScoop ?? false}
          onChange={(e) => setOverride(placement.id, { fingerScoop: e.target.checked })}
        />
        Finger scoop
      </label>
      <button className="danger" onClick={() => removePlacement(placement.id)}>
        Delete pocket
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ verify + export */

export function VerifyPanel() {
  const project = useDesignStore((s) => s.project);
  const container = useEffectiveContainer();
  const select = useDesignStore((s) => s.select);

  if (!container || !isUsableContainer(container)) {
    return (
      <section className="panel">
        <h2>Verify</h2>
        <p className="note warn">Measure the container cavity to run fit checks.</p>
      </section>
    );
  }
  const res = validateLayout(project, container);

  return (
    <section className="panel">
      <h2>
        Verify{" "}
        <span className={res.ok ? "badge ok" : "badge bad"}>
          {res.errorCount} error{res.errorCount === 1 ? "" : "s"}
        </span>{" "}
        <span className="badge warn">{res.warningCount} warn</span>
      </h2>
      {res.issues.length === 0 && <p className="note ok">All checks pass.</p>}
      <ul className="issue-list">
        {res.issues.map((i, idx) => (
          <li
            key={idx}
            className={i.severity}
            onClick={() => i.placementIds[0] && select(i.placementIds[0])}
          >
            <span className="dot" /> {i.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ExportPanel() {
  const project = useDesignStore((s) => s.project);
  const container = useEffectiveContainer();
  const [notes, setNotes] = useState<string[]>([]);
  const [info, setInfo] = useState<string>("");

  const usable = container && isUsableContainer(container) ? container : null;
  const res = usable ? validateLayout(project, usable) : null;
  const hasErrors = (res?.errorCount ?? 1) > 0;
  const hasPockets = project.placements.length > 0;

  function doExport() {
    if (!usable) return;
    const { bytes, result } = exportInsertSTL(project, usable);
    downloadBlob(bytes as BlobPart, `${slugify(project.name)}.stl`, "model/stl");
    setNotes(result.notes);
    setInfo(
      `${result.triangleCount.toLocaleString()} triangles · insert height ${result.height_mm.toFixed(1)} mm`,
    );
  }

  return (
    <section className="panel">
      <h2>Export</h2>
      {!usable && <p className="note warn">Measure the container cavity first.</p>}
      {usable && !usable.verified && (
        <p className="note warn">
          Container cavity is unverified. The STL will generate, but check the fit before you commit
          filament.
        </p>
      )}
      {usable && hasErrors && (
        <p className="note warn">Resolve the {res?.errorCount} error(s) in Verify first.</p>
      )}
      <button
        className="primary"
        disabled={!usable || hasErrors || !hasPockets}
        onClick={doExport}
      >
        Download STL
      </button>
      {info && <p className="source">{info}</p>}
      {notes.length > 0 && (
        <ul className="issue-list">
          {notes.map((n, i) => (
            <li key={i} className="warning">
              <span className="dot" /> {n}
            </li>
          ))}
        </ul>
      )}
      <p className="note">
        v1 geometry models each pocket as a plain rectangular recess (rotations are approximated by
        their bounding box; finger scoops not yet cut). Good for a first test print; expect to tune
        clearances.
      </p>
    </section>
  );
}
