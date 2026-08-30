import { useMemo, useRef } from "react";
import { PanResponder, useWindowDimensions, View } from "react-native";
import Svg, { G, Polygon, Rect, Text as SvgText } from "react-native-svg";

import {
  insertFootprint,
  isUsableContainer,
  resolveAllPockets,
  validateLayout,
} from "../../src/core";
import { useDesignStore, useEffectiveContainer } from "./store";
import { C, Note } from "./ui";

const PAD = 14;
const SNAP = 1;

export function ArrangeCanvas() {
  const project = useDesignStore((s) => s.project);
  const selectedId = useDesignStore((s) => s.selectedPlacementId);
  const select = useDesignStore((s) => s.select);
  const movePlacement = useDesignStore((s) => s.movePlacement);
  const { width: winW } = useWindowDimensions();

  const container = useEffectiveContainer();
  const usable = container && isUsableContainer(container) ? container : null;

  const model = useMemo(() => {
    if (!usable) return null;
    const res = validateLayout(project, usable);
    const badIds = new Set<string>();
    for (const i of res.issues) {
      if (i.severity === "error") i.placementIds.forEach((id) => badIds.add(id));
    }
    return {
      pockets: resolveAllPockets(project),
      footprint: insertFootprint(usable, project.global),
      cavW: usable.internal.x_mm,
      cavH: usable.internal.y_mm,
      cornerR: usable.features.cornerRadius_mm ?? 6,
      badIds,
    };
  }, [project, usable]);

  const drag = useRef<{ id: string; offX: number; offY: number } | null>(null);

  const geom = useMemo(() => {
    if (!model) return null;
    const vbW = model.cavW + 2 * PAD;
    const vbH = model.cavH + 2 * PAD;
    let boxW = Math.min(winW - 32, 440);
    let boxH = (boxW * vbH) / vbW;
    if (boxH > 460) {
      boxH = 460;
      boxW = (boxH * vbW) / vbH;
    }
    return { vbW, vbH, boxW, boxH, scale: boxW / vbW };
  }, [model, winW]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          if (!model || !geom) return;
          const mx = e.nativeEvent.locationX / geom.scale - PAD;
          const my = e.nativeEvent.locationY / geom.scale - PAD;
          const hit = [...model.pockets]
            .reverse()
            .find(
              (p) =>
                mx >= p.bounds.x &&
                mx <= p.bounds.x + p.bounds.w &&
                my >= p.bounds.y &&
                my <= p.bounds.y + p.bounds.h,
            );
          if (!hit) {
            drag.current = null;
            select(null);
            return;
          }
          select(hit.placementId);
          const pl = project.placements.find((p) => p.id === hit.placementId);
          if (pl) drag.current = { id: pl.id, offX: mx - pl.x_mm, offY: my - pl.y_mm };
        },
        onPanResponderMove: (e) => {
          if (!drag.current || !geom) return;
          const mx = e.nativeEvent.locationX / geom.scale - PAD;
          const my = e.nativeEvent.locationY / geom.scale - PAD;
          const nx = Math.round((mx - drag.current.offX) / SNAP) * SNAP;
          const ny = Math.round((my - drag.current.offY) / SNAP) * SNAP;
          movePlacement(drag.current.id, nx, ny);
        },
        onPanResponderRelease: () => {
          drag.current = null;
        },
        onPanResponderTerminate: () => {
          drag.current = null;
        },
      }),
    [model, geom, project.placements, movePlacement, select],
  );

  if (!usable) {
    return (
      <Note tone="warn">
        This container has no measured cavity yet. Enter its internal width / depth / height on the
        Container tab to start arranging.
      </Note>
    );
  }
  if (!model || !geom) return null;

  return (
    <View
      {...pan.panHandlers}
      style={{
        width: geom.boxW,
        height: geom.boxH,
        alignSelf: "center",
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 8,
        backgroundColor: C.panel,
        overflow: "hidden",
      }}
    >
      <Svg width={geom.boxW} height={geom.boxH} viewBox={`${-PAD} ${-PAD} ${geom.vbW} ${geom.vbH}`}>
        <Rect
          x={0}
          y={0}
          width={model.cavW}
          height={model.cavH}
          rx={model.cornerR}
          fill="#eef0f3"
          stroke="#aab0bb"
          strokeWidth={1}
        />
        <Rect
          x={model.footprint.x}
          y={model.footprint.y}
          width={model.footprint.w}
          height={model.footprint.h}
          rx={Math.max(2, model.cornerR - 3)}
          fill={C.slab}
          fillOpacity={0.5}
          stroke="#c7bda9"
          strokeWidth={0.7}
          strokeDasharray="3,2"
        />

        {model.pockets.map((p) => {
          const sel = p.placementId === selectedId;
          const bad = model.badIds.has(p.placementId);
          const pts = p.footprint.map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(" ");
          return (
            <G key={p.placementId}>
              <Polygon
                points={pts}
                fill={bad ? "rgba(201,60,60,0.22)" : "rgba(76,139,245,0.18)"}
                stroke={sel ? C.accentInk : bad ? C.bad : C.accent}
                strokeWidth={sel ? 1.4 : 0.8}
              />
              <SvgText
                x={p.bounds.x + p.bounds.w / 2}
                y={p.bounds.y + p.bounds.h / 2 + 1.6}
                fontSize={Math.max(3.5, Math.min(7, p.bounds.h / 3))}
                fill="#243044"
                textAnchor="middle"
              >
                {p.toolName.length > 16 ? p.toolName.slice(0, 15) + "…" : p.toolName}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
