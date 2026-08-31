import { useMemo, useRef, useState } from "react";
import { useDesignStore, useEffectiveContainer } from "../store/useDesignStore";
import { isUsableContainer, isUsableTool, type ToolCategory } from "../model/types";
import { insertFootprint, resolveClearance, resolveDepth } from "../layout/pockets";
import { toolShapeRects } from "../layout/toolShape";
import { validateLayout } from "../layout/validate";
import { boundingBox, rectPolygon, rotatePolygon, type Rect } from "../layout/geometry2d";
import { ToolGlyph } from "./toolIcons";

const PAD_MM = 14;

type ViewMode = "realistic" | "schematic";

interface Item {
  placementId: string;
  x_mm: number;
  y_mm: number;
  rot: number;
  name: string;
  category: ToolCategory;
  toolRect: Rect;
  clearRect: Rect;
  /** Pocket outline as tool-local rectangles, clearance applied, pre-rotation. */
  shapeParts: Rect[];
  /** True when the tool carries an explicit measured/traced outline. */
  exactOutline: boolean;
  center: { x: number; y: number };
  depth: number;
  fingerScoop: boolean;
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rotatedAABB(r: Rect, rot: number, center: { x: number; y: number }): Rect {
  if (rot % 360 === 0) return r;
  return boundingBox(rotatePolygon(rectPolygon(r), rot, center));
}

export function Canvas2D() {
  const project = useDesignStore((s) => s.project);
  const selectedId = useDesignStore((s) => s.selectedPlacementId);
  const select = useDesignStore((s) => s.select);
  const movePlacement = useDesignStore((s) => s.movePlacement);
  const autoArrangeAll = useDesignStore((s) => s.autoArrangeAll);

  const [snap, setSnap] = useState(1);
  const [view, setView] = useState<ViewMode>("realistic");
  const [showLabels, setShowLabels] = useState(true);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const container = useEffectiveContainer();
  const usable = container && isUsableContainer(container) ? container : null;

  const { items, issues, footprint, cavityW, cavityH, cornerR } = useMemo(() => {
    if (!usable) {
      return { items: [] as Item[], issues: [], footprint: null, cavityW: 0, cavityH: 0, cornerR: 0 };
    }
    const toolById = new Map(project.tools.map((t) => [t.id, t]));
    const built: Item[] = [];
    for (const p of project.placements) {
      const tool = toolById.get(p.toolId);
      if (!tool || !isUsableTool(tool)) continue;
      const c = resolveClearance(tool, p, project.global);
      const { l, w, h } = tool.bbox_mm;
      built.push({
        placementId: p.id,
        x_mm: p.x_mm,
        y_mm: p.y_mm,
        rot: p.rot_deg,
        name: tool.name,
        category: tool.category,
        toolRect: { x: p.x_mm, y: p.y_mm, w: l, h: w },
        clearRect: { x: p.x_mm - c, y: p.y_mm - c, w: l + 2 * c, h: w + 2 * c },
        shapeParts: toolShapeRects(tool).map((r) => ({
          x: p.x_mm + r.x - c,
          y: p.y_mm + r.y - c,
          w: r.w + 2 * c,
          h: r.h + 2 * c,
        })),
        exactOutline: !!tool.pocketRects && tool.pocketRects.length > 0,
        center: { x: p.x_mm + l / 2, y: p.y_mm + w / 2 },
        depth: resolveDepth(tool, p, h),
        fingerScoop: p.overrides.fingerScoop ?? tool.pocket.fingerScoop,
      });
    }
    const res = validateLayout(project, usable);
    return {
      items: built,
      issues: res.issues,
      footprint: insertFootprint(usable, project.global),
      cavityW: usable.internal.x_mm,
      cavityH: usable.internal.y_mm,
      cornerR: usable.features.cornerRadius_mm ?? 6,
    };
  }, [project, usable]);

  const maxDepth = useMemo(() => items.reduce((m, i) => Math.max(m, i.depth), 1), [items]);

  const badIds = useMemo(() => {
    const set = new Set<string>();
    for (const i of issues) {
      if (i.severity === "error") i.placementIds.forEach((id) => set.add(id));
    }
    return set;
  }, [issues]);

  const placeableCount = useMemo(
    () =>
      project.tools.filter(
        (t) => isUsableTool(t) && project.placements.some((p) => p.toolId === t.id),
      ).length,
    [project],
  );

  if (!usable) {
    return (
      <div className="canvas-empty">
        <p>
          <strong>{container?.name ?? "This container"}</strong> has no measured cavity yet.
        </p>
        <p>
          Enter its internal width / depth / height in <em>Container &amp; fit</em> to start
          arranging tools.
        </p>
      </div>
    );
  }

  function clientToMm(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function onPointerDown(e: React.PointerEvent, id: string, x_mm: number, y_mm: number) {
    e.stopPropagation();
    select(id);
    const m = clientToMm(e);
    drag.current = { id, dx: m.x - x_mm, dy: m.y - y_mm };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const m = clientToMm(e);
    const nx = Math.round((m.x - drag.current.dx) / snap) * snap;
    const ny = Math.round((m.y - drag.current.dy) / snap) * snap;
    movePlacement(drag.current.id, nx, ny);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (drag.current) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    drag.current = null;
  }

  const vb = `${-PAD_MM} ${-PAD_MM} ${cavityW + 2 * PAD_MM} ${cavityH + 2 * PAD_MM}`;
  const realistic = view === "realistic";

  return (
    <div className="canvas-wrap">
      <div className="canvas-toolbar">
        <span>
          {cavityW.toFixed(1)} &times; {cavityH.toFixed(1)} mm cavity
        </span>
        <div className="canvas-toolbar-controls">
          <div className="seg">
            <button className={realistic ? "on" : ""} onClick={() => setView("realistic")}>
              Realistic
            </button>
            <button className={!realistic ? "on" : ""} onClick={() => setView("schematic")}>
              Schematic
            </button>
          </div>
          <button onClick={autoArrangeAll} title="Repack every tool into rows">
            Auto-arrange
          </button>
          <label className="chk">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            labels
          </label>
          <label>
            snap
            <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
              <option value={0.5}>0.5</option>
              <option value={1}>1</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="canvas-svg"
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerDown={() => select(null)}
      >
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e4e7ec" strokeWidth="0.3" />
          </pattern>
          <linearGradient id="slabFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7f5f1" />
            <stop offset="1" stopColor="#e7e1d6" />
          </linearGradient>
          <linearGradient id="cavityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#edeff2" />
            <stop offset="1" stopColor="#e0e3e9" />
          </linearGradient>
          <filter id="slabShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#3a352c" floodOpacity="0.28" />
          </filter>
          <filter id="pocketInset" x="-40%" y="-40%" width="180%" height="180%">
            <feOffset in="SourceAlpha" dx="0" dy="1.2" result="o" />
            <feGaussianBlur in="o" stdDeviation="1.1" result="b" />
            <feComposite in="b" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="inner" />
            <feColorMatrix
              in="inner"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"
              result="shadow"
            />
            <feComposite in="shadow" in2="SourceGraphic" operator="over" />
          </filter>
        </defs>

        {/* container cavity */}
        <rect
          x={0}
          y={0}
          width={cavityW}
          height={cavityH}
          rx={cornerR}
          fill={realistic ? "url(#cavityFill)" : "url(#grid)"}
          stroke="#aab0bb"
          strokeWidth={realistic ? 1.4 : 0.8}
        />
        {realistic && (
          <rect
            x={2}
            y={2}
            width={Math.max(0, cavityW - 4)}
            height={Math.max(0, cavityH - 4)}
            rx={Math.max(0, cornerR - 2)}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        )}

        {/* insert slab */}
        {footprint &&
          (realistic ? (
            <rect
              x={footprint.x}
              y={footprint.y}
              width={footprint.w}
              height={footprint.h}
              rx={Math.max(2, cornerR - 3)}
              fill="url(#slabFill)"
              stroke="#c7bda9"
              strokeWidth={0.8}
              filter="url(#slabShadow)"
            />
          ) : (
            <rect
              x={footprint.x}
              y={footprint.y}
              width={footprint.w}
              height={footprint.h}
              fill="none"
              stroke="#4c8bf5"
              strokeWidth={0.6}
              strokeDasharray="3 2"
            />
          ))}

        {items.map((it) => {
          const isSel = it.placementId === selectedId;
          const isBad = badIds.has(it.placementId);
          const cr = it.clearRect;
          const rx = Math.min(3, cr.w / 6, cr.h / 6);
          const floor = lerpHex("#e3ddd0", "#b3a88f", it.depth / maxDepth);
          const scoopR = Math.min(cr.w * 0.3, 9);
          const aabb = rotatedAABB(cr, it.rot, it.center);
          return (
            <g key={it.placementId}>
              <g transform={`rotate(${it.rot} ${it.center.x} ${it.center.y})`}>
                {realistic ? (
                  <>
                    {it.fingerScoop && (
                      <circle
                        cx={cr.x + cr.w / 2}
                        cy={cr.y + cr.h}
                        r={scoopR}
                        fill={floor}
                        filter="url(#pocketInset)"
                      />
                    )}
                    {it.shapeParts.map((sp, i) => (
                      <rect
                        key={i}
                        x={sp.x}
                        y={sp.y}
                        width={sp.w}
                        height={sp.h}
                        rx={Math.min(3, sp.w / 6, sp.h / 6)}
                        fill={floor}
                        stroke="#a99e86"
                        strokeWidth={0.4}
                        filter="url(#pocketInset)"
                      />
                    ))}
                    {!it.exactOutline && (
                      <ToolGlyph
                        category={it.category}
                        name={it.name}
                        x={it.toolRect.x}
                        y={it.toolRect.y}
                        w={it.toolRect.w}
                        h={it.toolRect.h}
                        color="#544c3e"
                      />
                    )}
                  </>
                ) : (
                  it.shapeParts.map((sp, i) => (
                    <rect
                      key={i}
                      x={sp.x}
                      y={sp.y}
                      width={sp.w}
                      height={sp.h}
                      fill="rgba(76,139,245,0.14)"
                      stroke="#4c8bf5"
                      strokeWidth={0.6}
                    />
                  ))
                )}

                {isBad && (
                  <rect
                    x={cr.x}
                    y={cr.y}
                    width={cr.w}
                    height={cr.h}
                    rx={rx}
                    fill="rgba(201,60,60,0.26)"
                    stroke="#c23b3b"
                    strokeWidth={0.9}
                  />
                )}
                {isSel && (
                  <rect
                    x={cr.x - 1}
                    y={cr.y - 1}
                    width={cr.w + 2}
                    height={cr.h + 2}
                    rx={rx + 1}
                    fill="none"
                    stroke="#1b4fb0"
                    strokeWidth={1.2}
                  />
                )}
                {/* drag hit target */}
                <rect
                  x={cr.x}
                  y={cr.y}
                  width={cr.w}
                  height={cr.h}
                  fill="transparent"
                  style={{ cursor: "move" }}
                  onPointerDown={(e) => onPointerDown(e, it.placementId, it.x_mm, it.y_mm)}
                />
              </g>

              {showLabels && (
                <text
                  x={aabb.x + aabb.w / 2}
                  y={aabb.y + aabb.h + 5}
                  textAnchor="middle"
                  fontSize={4.5}
                  fill="#5a6270"
                  stroke="#ffffff"
                  strokeWidth={1.1}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {it.name.length > 22 ? it.name.slice(0, 21) + "…" : it.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {items.length === 0 && (
        <div className="canvas-hint">
          {placeableCount === 0
            ? "Add tools with measurements, then they'll show up here to arrange."
            : "Nothing placed yet — hit Auto-arrange, or Place a tool from the list."}
        </div>
      )}
    </div>
  );
}
