import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, useWindowDimensions, View } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import {
  insertFootprint,
  isUsableContainer,
  resolveAllPockets,
  validateLayout,
} from "../../src/core";
import { useDesignStore, useEffectiveContainer } from "./store";
import { ToolGlyph } from "./toolGlyph";
import { C, Note } from "./ui";

const PAD = 14;
const SNAP = 1;

export function ArrangeCanvas({ mode = "realistic" }: { mode?: "realistic" | "schematic" }) {
  const project = useDesignStore((s) => s.project);
  const selectedId = useDesignStore((s) => s.selectedPlacementId);
  const select = useDesignStore((s) => s.select);
  const movePlacement = useDesignStore((s) => s.movePlacement);
  const { width: winW } = useWindowDimensions();

  const container = useEffectiveContainer();
  const usable = container && isUsableContainer(container) ? container : null;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const gesture = useRef<
    | { kind: "move"; id: string; offX: number; offY: number }
    | { kind: "pan"; grantX: number; grantY: number; startX: number; startY: number }
    | null
  >(null);

  const model = useMemo(() => {
    if (!usable) return null;
    const res = validateLayout(project, usable);
    const badIds = new Set<string>();
    for (const i of res.issues) {
      if (i.severity === "error") i.placementIds.forEach((id) => badIds.add(id));
    }
    const pockets = resolveAllPockets(project);
    return {
      pockets,
      footprint: insertFootprint(usable, project.global),
      cavW: usable.internal.x_mm,
      cavH: usable.internal.y_mm,
      cornerR: usable.features.cornerRadius_mm ?? 6,
      maxDepth: Math.max(1, ...pockets.map((p) => p.depth_mm)),
      badIds,
    };
  }, [project, usable]);

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

  const toMm = (px: number, axis: "x" | "y") => {
    if (!geom) return 0;
    const origin = (axis === "x" ? pan.x : pan.y) - PAD;
    return origin + px / (geom.scale * zoom);
  };

  const pan_ = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          if (!model) return;
          const mx = toMm(e.nativeEvent.locationX, "x");
          const my = toMm(e.nativeEvent.locationY, "y");
          const hit = [...model.pockets]
            .reverse()
            .find(
              (p) =>
                mx >= p.bounds.x &&
                mx <= p.bounds.x + p.bounds.w &&
                my >= p.bounds.y &&
                my <= p.bounds.y + p.bounds.h,
            );
          if (hit) {
            select(hit.placementId);
            const pl = project.placements.find((p) => p.id === hit.placementId);
            if (pl) gesture.current = { kind: "move", id: pl.id, offX: mx - pl.x_mm, offY: my - pl.y_mm };
          } else {
            select(null);
            gesture.current = {
              kind: "pan",
              grantX: e.nativeEvent.locationX,
              grantY: e.nativeEvent.locationY,
              startX: pan.x,
              startY: pan.y,
            };
          }
        },
        onPanResponderMove: (e) => {
          const gt = gesture.current;
          if (!gt || !geom) return;
          if (gt.kind === "move") {
            const mx = toMm(e.nativeEvent.locationX, "x");
            const my = toMm(e.nativeEvent.locationY, "y");
            movePlacement(
              gt.id,
              Math.round((mx - gt.offX) / SNAP) * SNAP,
              Math.round((my - gt.offY) / SNAP) * SNAP,
            );
          } else {
            const dx = (e.nativeEvent.locationX - gt.grantX) / (geom.scale * zoom);
            const dy = (e.nativeEvent.locationY - gt.grantY) / (geom.scale * zoom);
            setPan({ x: gt.startX - dx, y: gt.startY - dy });
          }
        },
        onPanResponderRelease: () => {
          gesture.current = null;
        },
        onPanResponderTerminate: () => {
          gesture.current = null;
        },
      }),
    [model, geom, zoom, pan.x, pan.y, project.placements, movePlacement, select],
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

  const vbW = geom.vbW / zoom;
  const vbH = geom.vbH / zoom;
  const vx = -PAD + pan.x;
  const vy = -PAD + pan.y;
  const realistic = mode === "realistic";

  return (
    <View>
      <View
        {...pan_.panHandlers}
        style={{
          width: geom.boxW,
          height: geom.boxH,
          alignSelf: "center",
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 8,
          backgroundColor: realistic ? "#eef0f3" : C.panel,
          overflow: "hidden",
        }}
      >
        <Svg width={geom.boxW} height={geom.boxH} viewBox={`${vx} ${vy} ${vbW} ${vbH}`}>
          <Defs>
            <LinearGradient id="slab" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#f7f5f1" />
              <Stop offset="1" stopColor="#e7e1d6" />
            </LinearGradient>
          </Defs>

          <Rect
            x={0}
            y={0}
            width={model.cavW}
            height={model.cavH}
            rx={model.cornerR}
            fill={realistic ? "#e9ebef" : "#ffffff"}
            stroke="#aab0bb"
            strokeWidth={1}
          />

          {realistic ? (
            <Rect
              x={model.footprint.x}
              y={model.footprint.y}
              width={model.footprint.w}
              height={model.footprint.h}
              rx={Math.max(2, model.cornerR - 3)}
              fill="url(#slab)"
              stroke="#c7bda9"
              strokeWidth={0.8}
            />
          ) : (
            <Rect
              x={model.footprint.x}
              y={model.footprint.y}
              width={model.footprint.w}
              height={model.footprint.h}
              fill="none"
              stroke={C.accent}
              strokeWidth={0.6}
              strokeDasharray={[3, 2]}
            />
          )}

          {model.pockets.map((p) => {
            const sel = p.placementId === selectedId;
            const bad = model.badIds.has(p.placementId);
            const pts = p.footprint.map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(" ");
            const b = p.bounds;
            const rx = Math.min(3, b.w / 6, b.h / 6);
            const t = Math.max(0, Math.min(1, p.depth_mm / model.maxDepth));
            const floor = lerpHex("#e3ddd0", "#b3a88f", t);
            const tool = project.tools.find((tt) => tt.id === p.toolId);

            if (!realistic) {
              return (
                <G key={p.placementId}>
                  <Polygon
                    points={pts}
                    fill={bad ? "rgba(201,60,60,0.22)" : "rgba(76,139,245,0.18)"}
                    stroke={sel ? C.accentInk : bad ? C.bad : C.accent}
                    strokeWidth={sel ? 1.4 : 0.8}
                  />
                  <SvgText
                    x={b.x + b.w / 2}
                    y={b.y + b.h / 2 + 1.6}
                    fontSize={Math.max(3.5, Math.min(7, b.h / 3))}
                    fill="#243044"
                    textAnchor="middle"
                  >
                    {p.toolName.length > 16 ? p.toolName.slice(0, 15) + "…" : p.toolName}
                  </SvgText>
                </G>
              );
            }

            return (
              <G key={p.placementId}>
                {/* recess: dark rim offset + floor + top highlight to fake depth */}
                <Rect x={b.x} y={b.y + 0.6} width={b.w} height={b.h} rx={rx} fill="#8a806a" opacity={0.5} />
                <Rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={rx}
                  fill={floor}
                  stroke="#a99e86"
                  strokeWidth={0.4}
                />
                <Rect
                  x={b.x + 0.4}
                  y={b.y + 0.4}
                  width={Math.max(0, b.w - 0.8)}
                  height={Math.max(0, b.h - 0.8)}
                  rx={Math.max(0, rx - 0.4)}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.35}
                  strokeWidth={0.5}
                />
                {tool && !(tool.pocketRects && tool.pocketRects.length > 0) && (
                  <ToolGlyph
                    category={tool.category}
                    name={tool.name}
                    x={b.x}
                    y={b.y}
                    w={b.w}
                    h={b.h}
                    color="#544c3e"
                  />
                )}
                {bad && (
                  <Rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx={rx}
                    fill="rgba(201,60,60,0.26)"
                    stroke={C.bad}
                    strokeWidth={0.9}
                  />
                )}
                {sel && (
                  <Rect
                    x={b.x - 1}
                    y={b.y - 1}
                    width={b.w + 2}
                    height={b.h + 2}
                    rx={rx + 1}
                    fill="none"
                    stroke={C.accentInk}
                    strokeWidth={1.2}
                  />
                )}
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={{ flexDirection: "row", alignSelf: "center", marginTop: 8, gap: 8 }}>
        <ZoomBtn label="−" onPress={() => setZoom((z) => Math.max(1, z / 1.5))} />
        <ZoomBtn label={`${Math.round(zoom * 100)}%`} onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} />
        <ZoomBtn label="+" onPress={() => setZoom((z) => Math.min(6, z * 1.5))} />
      </View>
    </View>
  );
}

function ZoomBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minWidth: 44,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.panel,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink }}>{label}</Text>
    </Pressable>
  );
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
