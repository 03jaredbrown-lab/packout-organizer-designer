import type { ReactNode } from "react";
import type { ToolCategory } from "../model/types";

/**
 * Rough top-down silhouettes, drawn in a 100x100 box with the tool's long axis
 * horizontal and any handle pointing down (+y). Scaled to the pocket at render
 * time. Not engineering drawings — just enough that a drill reads as a drill.
 */

type GlyphKey = ToolCategory | "tape" | "knife";

function classify(category: ToolCategory, name: string): GlyphKey {
  const n = name.toLowerCase();
  // Name keywords come first: a hand-measured tool is usually left at the
  // "other" category, so "M18 impact" should still read as an impact driver.
  if (/tape measure|measuring tape|\btape\b/.test(n)) return "tape";
  if (/utility knife|box cutter|\bknife\b|\bblade\b|snips|shears/.test(n)) return "knife";
  if (/impact|ratchet|\bwrench\b/.test(n)) return "impact";
  if (/hammer ?drill|\bdrill\b|\bdriver\b|rotary hammer/.test(n)) return "drill";
  if (/sawzall|reciprocating|recip saw|circular saw|\bsaw\b|grinder|multi-?tool|oscillating/.test(n))
    return "saw";
  if (/multimeter|voltage|clamp meter|\bmeter\b|\btester\b|laser|\blevel\b|stud finder/.test(n))
    return "meter";
  if (/battery|charger|\bpack\b|bit set|socket set|driver set|\bkit\b/.test(n)) return "accessory";
  if (/pliers|screwdriver|nut driver|chisel|pry bar|crow ?bar|\bsquare\b|\bclamp\b|hammer\b/.test(n))
    return "hand-tool";
  return category;
}

interface GlyphProps {
  category: ToolCategory;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export function ToolGlyph({ category, name, x, y, w, h, color }: GlyphProps) {
  const key = classify(category, name);
  const soft = { fill: color, opacity: 0.32 };
  const solid = { fill: color };

  let body: ReactNode;
  switch (key) {
    case "drill":
      body = (
        <>
          <rect x={8} y={30} width={54} height={30} rx={6} {...solid} />
          <rect x={58} y={40} width={12} height={10} rx={2} {...solid} />
          <circle cx={74} cy={45} r={8} {...solid} />
          <circle cx={74} cy={45} r={3} {...soft} />
          <rect x={26} y={56} width={20} height={30} rx={5} {...solid} />
          <rect x={20} y={80} width={32} height={15} rx={4} {...solid} />
        </>
      );
      break;
    case "impact":
    case "driver":
      body = (
        <>
          <rect x={12} y={32} width={44} height={26} rx={6} {...solid} />
          <rect x={52} y={40} width={10} height={10} rx={2} {...solid} />
          <circle cx={66} cy={45} r={7} {...solid} />
          <rect x={28} y={54} width={18} height={28} rx={5} {...solid} />
          <rect x={22} y={78} width={30} height={15} rx={4} {...solid} />
        </>
      );
      break;
    case "saw":
      body = (
        <>
          <circle cx={60} cy={54} r={30} {...solid} />
          <circle cx={60} cy={54} r={6} {...soft} />
          <rect x={6} y={36} width={42} height={34} rx={7} {...solid} />
          <rect x={10} y={18} width={46} height={16} rx={7} {...soft} />
        </>
      );
      break;
    case "meter":
      body = (
        <>
          <rect x={16} y={18} width={68} height={64} rx={10} {...solid} />
          <rect x={24} y={24} width={52} height={20} rx={3} {...soft} />
          <circle cx={40} cy={62} r={11} {...soft} />
          <path d="M72 66 q16 6 18 24" stroke={color} strokeWidth={4} fill="none" opacity={0.5} />
        </>
      );
      break;
    case "accessory":
      body = (
        <>
          <rect x={24} y={16} width={52} height={10} rx={2} {...solid} />
          <rect x={16} y={24} width={68} height={52} rx={9} {...solid} />
          <rect x={30} y={12} width={12} height={8} rx={2} {...solid} />
          <rect x={58} y={12} width={12} height={8} rx={2} {...solid} />
          <circle cx={34} cy={62} r={4} {...soft} />
          <circle cx={50} cy={62} r={4} {...soft} />
          <circle cx={66} cy={62} r={4} {...soft} />
        </>
      );
      break;
    case "tape":
      body = (
        <>
          <rect x={16} y={22} width={56} height={56} rx={12} {...solid} />
          <circle cx={44} cy={50} r={19} {...soft} />
          <circle cx={44} cy={50} r={6} {...solid} />
          <rect x={70} y={43} width={20} height={14} rx={2} {...solid} />
          <rect x={88} y={40} width={4} height={20} rx={1} {...solid} />
        </>
      );
      break;
    case "knife":
      body = (
        <>
          <rect x={12} y={40} width={52} height={20} rx={9} {...solid} />
          <polygon points="62,42 90,47 90,55 62,58" {...solid} />
          <circle cx={28} cy={50} r={4} {...soft} />
        </>
      );
      break;
    case "hand-tool":
      body = (
        <>
          <rect x={14} y={44} width={52} height={12} rx={6} {...solid} />
          <path
            d="M62 32 h20 v10 h-10 v16 h10 v10 h-20 a4 4 0 0 1 -4 -4 v-34 a4 4 0 0 1 4 -4 z"
            {...solid}
          />
        </>
      );
      break;
    default:
      // Generic power tool — a body, a nose, and a pistol grip. Reads as "a
      // tool" rather than a plain box for anything we can't identify.
      body = (
        <>
          <rect x={10} y={30} width={50} height={30} rx={9} {...solid} />
          <rect x={56} y={38} width={15} height={14} rx={3} {...solid} />
          <circle cx={74} cy={45} r={7} {...solid} />
          <circle cx={74} cy={45} r={3} {...soft} />
          <rect x={24} y={56} width={19} height={30} rx={6} {...solid} />
          <rect x={18} y={80} width={30} height={14} rx={4} {...soft} />
        </>
      );
  }

  return (
    <svg
      x={x}
      y={y}
      width={w}
      height={h}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
      pointerEvents="none"
    >
      {body}
    </svg>
  );
}
