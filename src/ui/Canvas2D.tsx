import { useMemo, useRef, useState } from "react";
import { useDesignStore, useEffectiveContainer } from "../store/useDesignStore";
import { isUsableContainer } from "../model/types";
import { insertFootprint, resolveAllPockets } from "../layout/pockets";
import { validateLayout } from "../layout/validate";
import type { Polygon } from "../layout/geometry2d";

const PAD_MM = 12;

function polyPoints(poly: Polygon): string {
  return poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function Canvas2D() {
  const project = useDesignStore((s) => s.project);
  const selectedId = useDesignStore((s) => s.selectedPlacementId);
  const select = useDesignStore((s) => s.select);
  const movePlacement = useDesignStore((s) => s.movePlacement);

  const [snap, setSnap] = useState(1);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const container = useEffectiveContainer();
  const usable = container && isUsableContainer(container) ? container : null;

  const { pockets, issues, footprint, cavityW, cavityH } = useMemo(() => {
    if (!usable) {
      return { pockets: [], issues: [], footprint: null, cavityW: 0, cavityH: 0 };
    }
    const res = validateLayout(project, usable);
    return {
      pockets: resolveAllPockets(project),
      issues: res.issues,
      footprint: insertFootprint(usable, project.global),
      cavityW: usable.internal.x_mm,
      cavityH: usable.internal.y_mm,
    };
  }, [project, usable]);

  const badPlacementIds = useMemo(() => {
    const set = new Set<string>();
    for (const i of issues) {
      if (i.severity === "error") i.placementIds.forEach((id) => set.add(id));
    }
    return set;
  }, [issues]);

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

  return (
    <div className="canvas-wrap">
      <div className="canvas-toolbar">
        <span>
          Cavity {cavityW.toFixed(1)} &times; {cavityH.toFixed(1)} mm
        </span>
        <label>
          snap
          <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
            <option value={0.5}>0.5 mm</option>
            <option value={1}>1 mm</option>
            <option value={5}>5 mm</option>
            <option value={10}>10 mm</option>
          </select>
        </label>
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
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e5ea" strokeWidth="0.3" />
          </pattern>
        </defs>

        <rect x={0} y={0} width={cavityW} height={cavityH} fill="url(#grid)" stroke="#9aa3b2" strokeWidth={0.8} />

        {footprint && (
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
        )}

        {pockets.map((pk) => {
          const isSel = pk.placementId === selectedId;
          const isBad = badPlacementIds.has(pk.placementId);
          const cx = pk.bounds.x + pk.bounds.w / 2;
          const cy = pk.bounds.y + pk.bounds.h / 2;
          return (
            <g key={pk.placementId}>
              <polygon
                points={polyPoints(pk.footprint)}
                fill={isBad ? "rgba(220,70,70,0.18)" : "rgba(76,139,245,0.16)"}
                stroke={isSel ? "#1b4fb0" : isBad ? "#c23b3b" : "#4c8bf5"}
                strokeWidth={isSel ? 1.1 : 0.7}
                onPointerDown={(e) => onPointerDown(e, pk.placementId, pk.bounds.x, pk.bounds.y)}
                style={{ cursor: "move" }}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(4, Math.min(9, pk.bounds.h / 3))}
                fill="#243044"
                pointerEvents="none"
              >
                {pk.toolName.length > 18 ? pk.toolName.slice(0, 17) + "…" : pk.toolName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
