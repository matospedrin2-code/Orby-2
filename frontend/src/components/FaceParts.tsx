// SVG drawing of every face part, in a 640x420 viewBox.
import { ClipPath, Defs, Ellipse, G, Path, Rect, Text as SvgText, Circle } from "react-native-svg";
import type { BrowKind, Extra, EyeKind, MouthKind } from "@/src/faceCatalog";
import { colors, fonts } from "@/src/theme";

export const VB_W = 640;
export const VB_H = 420;
export const EYE = { w: 230, h: 200, cy: 170, lx: 140, rx: 500 };
export const MOUTH = { x: 320, y: 345 };

const FILL = colors.eyeFill;
const EDGE = colors.eyeEdge;
const GLOW = colors.eyeGlow;
const INK = colors.eyeInk;
const BLUSH = colors.blush;

function GlowRect({ x, y, w, h, r }: { x: number; y: number; w: number; h: number; r: number }) {
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={GLOW} strokeWidth={24} strokeOpacity={0.1} />
      <Rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={GLOW} strokeWidth={11} strokeOpacity={0.22} />
      <Rect x={x} y={y} width={w} height={h} rx={r} fill={FILL} stroke={EDGE} strokeWidth={5} />
    </>
  );
}

function GlowStroke({ d, width }: { d: string; width: number }) {
  return (
    <>
      <Path d={d} stroke={GLOW} strokeWidth={width + 18} strokeOpacity={0.12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke={EDGE} strokeWidth={width + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke={FILL} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function GlowFill({ d }: { d: string }) {
  return (
    <>
      <Path d={d} stroke={GLOW} strokeWidth={18} strokeOpacity={0.12} fill="none" strokeLinejoin="round" />
      <Path d={d} fill={FILL} stroke={EDGE} strokeWidth={5} strokeLinejoin="round" />
    </>
  );
}

const ink = (d: string, w = 10) => <Path d={d} stroke={INK} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />;

function starPath(cx: number, cy: number, R: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)} `;
  }
  return d + "Z";
}

export function heartPath(cx: number, cy: number, s: number) {
  return `M${cx},${cy + s * 0.9} C${cx - s * 1.4},${cy} ${cx - s * 0.9},${cy - s * 1.1} ${cx},${cy - s * 0.35} C${cx + s * 0.9},${cy - s * 1.1} ${cx + s * 1.4},${cy} ${cx},${cy + s * 0.9} Z`;
}

function spiralPath(cx: number, cy: number) {
  let d = "";
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * Math.PI * 6;
    const r = 3 + i * 0.75;
    d += `${i ? "L" : "M"}${(cx + Math.cos(t) * r).toFixed(1)},${(cy + Math.sin(t) * r).toFixed(1)} `;
  }
  return d;
}

// top cut of the eye: fraction of height at the outer and inner side
const CUTS: Partial<Record<EyeKind, { outer: number; inner: number; bottom?: number }>> = {
  flat: { outer: 0.36, inner: 0.36 },
  side: { outer: 0.36, inner: 0.36 },
  tired: { outer: 0.5, inner: 0.5 },
  angry: { outer: 0.04, inner: 0.42 },
  sad: { outer: 0.4, inner: 0.04 },
  squint: { outer: 0.28, inner: 0.34, bottom: 0.24 },
};

export function EyeShape({ kind, side }: { kind: EyeKind; side: "L" | "R" }) {
  const cx = side === "L" ? EYE.lx : EYE.rx;
  const cy = EYE.cy;
  let w = EYE.w;
  let h = EYE.h;
  let r = w * 0.3;
  if (kind === "big") { w *= 1.07; h *= 1.1; r = w * 0.34; }
  if (kind === "small") { w *= 0.8; h *= 0.8; }
  if (kind === "round") { w *= 0.95; h = w; r = w / 2; }
  const x = cx - w / 2;
  const y = cy - h / 2;
  const id = `clip-${side}-${kind}`;
  const sgn = side === "L" ? 1 : -1; // inner side direction

  const cut = CUTS[kind];
  if (cut) {
    const yo = y + h * cut.outer;
    const yi = y + h * cut.inner;
    const xo = side === "L" ? x - 30 : x + w + 30;
    const xi = side === "L" ? x + w + 30 : x - 30;
    const yb = y + h * (1 - (cut.bottom ?? 0));
    const clip = `M${xo},${yo} L${xi},${yi} L${xi},${yb} L${xo},${yb} Z`;
    return (
      <G>
        <Defs>
          <ClipPath id={id}><Path d={clip} /></ClipPath>
        </Defs>
        <G clipPath={`url(#${id})`}>
          <GlowRect x={x} y={y} w={w} h={h} r={r} />
        </G>
        <Path d={`M${side === "L" ? x + 6 : x + w - 6},${yo + (yi - yo) * 0.03} L${side === "L" ? x + w - 6 : x + 6},${yi - (yi - yo) * 0.03}`} stroke={EDGE} strokeWidth={5} strokeLinecap="round" />
        {kind === "side" && <Circle cx={cx + w * 0.26} cy={cy + h * 0.12} r={w * 0.07} fill={INK} />}
      </G>
    );
  }

  switch (kind) {
    case "smileClosed": {
      const clip = `M${x - 20},${y - 20} H${x + w + 20} V${cy + h * 0.14} Q${cx},${cy - h * 0.42} ${x - 20},${cy + h * 0.14} Z`;
      return (
        <G>
          <Defs><ClipPath id={id}><Path d={clip} /></ClipPath></Defs>
          <G clipPath={`url(#${id})`}><GlowRect x={x} y={y} w={w} h={h} r={r} /></G>
        </G>
      );
    }
    case "arc":
      return <GlowStroke d={`M${cx - w * 0.4},${cy + h * 0.2} Q${cx},${cy - h * 0.7} ${cx + w * 0.4},${cy + h * 0.2}`} width={34} />;
    case "closed":
      return <GlowStroke d={`M${cx - w * 0.42},${cy + h * 0.08} Q${cx},${cy + h * 0.26} ${cx + w * 0.42},${cy + h * 0.08}`} width={16} />;
    case "wink":
      return <GlowStroke d={`M${cx - sgn * w * 0.28},${cy - h * 0.26} L${cx + sgn * w * 0.24},${cy} L${cx - sgn * w * 0.28},${cy + h * 0.26}`} width={20} />;
  }

  return (
    <G>
      <GlowRect x={x} y={y} w={w} h={h} r={r} />
      {kind === "relaxed" && ink(`M${cx - w * 0.28},${cy - h * 0.02} Q${cx},${cy + h * 0.2} ${cx + w * 0.28},${cy - h * 0.02}`, 10)}
      {kind === "chevron" && ink(`M${cx - w * 0.28},${cy + h * 0.14} L${cx},${cy - h * 0.14} L${cx + w * 0.28},${cy + h * 0.14}`, 15)}
      {kind === "star" && <Path d={starPath(cx, cy, w * 0.27, w * 0.12)} stroke={INK} strokeWidth={9} strokeLinejoin="round" fill="none" />}
      {kind === "heart" && <Path d={heartPath(cx, cy + 4, w * 0.24)} stroke={INK} strokeWidth={9} strokeLinejoin="round" fill="none" />}
      {kind === "dot" && <Circle cx={cx} cy={cy} r={w * 0.075} fill={INK} />}
      {kind === "ring" && <Ellipse cx={cx} cy={cy} rx={w * 0.1} ry={h * 0.17} stroke={INK} strokeWidth={9} fill="none" />}
      {kind === "sparkle" && (
        <>
          <Circle cx={cx} cy={cy} r={w * 0.24} fill={INK} />
          <Circle cx={cx - w * 0.08} cy={cy - h * 0.1} r={w * 0.075} fill={colors.onSurface} />
          <Circle cx={cx + w * 0.09} cy={cy + h * 0.09} r={w * 0.035} fill={colors.onSurface} />
        </>
      )}
      {kind === "spiral" && ink(spiralPath(cx, cy), 7)}
    </G>
  );
}

export function Brows({ kind }: { kind: BrowKind }) {
  if (kind === "none") return null;
  const one = (side: "L" | "R", k: BrowKind) => {
    const cx = side === "L" ? EYE.lx : EYE.rx;
    const y0 = EYE.cy - EYE.h / 2 - 34;
    const s = side === "L" ? 1 : -1; // + = toward inner side
    const ax = cx - s * EYE.w * 0.32;
    const bx = cx + s * EYE.w * 0.3;
    let d = "";
    if (k === "raised") d = `M${ax},${y0 + 4} Q${cx},${y0 - 20} ${bx},${y0 + 4}`;
    else if (k === "flat") d = `M${ax},${y0 + 6} Q${cx},${y0} ${bx},${y0 + 6}`;
    else if (k === "angry") d = `M${ax},${y0 - 4} L${bx},${y0 + 24}`;
    else if (k === "sad") d = `M${ax},${y0 + 20} L${bx},${y0 - 8}`;
    else d = `M${ax},${y0 + 18} Q${cx},${y0 - 10} ${bx},${y0 - 4}`; // worried
    return <GlowStroke key={side} d={d} width={11} />;
  };
  if (kind === "skeptic") return <>{one("L", "raised")}{one("R", "flat")}</>;
  return <>{one("L", kind)}{one("R", kind)}</>;
}

export function Mouth({ kind }: { kind: MouthKind }) {
  const { x: m, y } = MOUTH;
  switch (kind) {
    case "none": return null;
    case "line": return <GlowStroke d={`M${m - 26},${y} L${m + 26},${y}`} width={13} />;
    case "smallSmile": return <GlowStroke d={`M${m - 42},${y - 8} Q${m},${y + 18} ${m + 42},${y - 8}`} width={11} />;
    case "smile": return <GlowStroke d={`M${m - 68},${y - 14} Q${m},${y + 28} ${m + 68},${y - 14}`} width={12} />;
    case "bigSmile":
      return <GlowFill d={`M${m - 95},${y - 22} Q${m},${y - 8} ${m + 95},${y - 22} C${m + 95},${y + 12} ${m + 52},${y + 30} ${m},${y + 30} C${m - 52},${y + 30} ${m - 95},${y + 12} ${m - 95},${y - 22} Z`} />;
    case "openD":
      return <GlowFill d={`M${m - 52},${y - 18} L${m + 52},${y - 18} C${m + 52},${y + 26} ${m + 26},${y + 44} ${m},${y + 44} C${m - 26},${y + 44} ${m - 52},${y + 26} ${m - 52},${y - 18} Z`} />;
    case "wideD":
      return <GlowFill d={`M${m - 78},${y - 22} L${m + 78},${y - 22} C${m + 78},${y + 30} ${m + 38},${y + 52} ${m},${y + 52} C${m - 38},${y + 52} ${m - 78},${y + 30} ${m - 78},${y - 22} Z`} />;
    case "o": return <GlowFill d={`M${m - 15},${y} a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0`} />;
    case "O": return <GlowFill d={`M${m - 32},${y} a32,32 0 1,0 64,0 a32,32 0 1,0 -64,0`} />;
    case "oval": return <GlowFill d={`M${m - 22},${y} a22,28 0 1,0 44,0 a22,28 0 1,0 -44,0`} />;
    case "frown": return <GlowStroke d={`M${m - 48},${y + 14} Q${m},${y - 16} ${m + 48},${y + 14}`} width={11} />;
    case "smallFrown": return <GlowStroke d={`M${m - 26},${y + 8} Q${m},${y - 8} ${m + 26},${y + 8}`} width={10} />;
    case "wavy": return <GlowStroke d={`M${m - 50},${y} Q${m - 37},${y - 12} ${m - 25},${y} Q${m - 12},${y + 12} ${m},${y} Q${m + 12},${y - 12} ${m + 25},${y} Q${m + 37},${y + 12} ${m + 50},${y}`} width={9} />;
    case "zigzag": return <GlowStroke d={`M${m - 40},${y + 12} L${m - 20},${y - 8} L${m},${y + 12} L${m + 20},${y - 8} L${m + 40},${y + 12}`} width={9} />;
    case "cat": return <GlowStroke d={`M${m - 40},${y - 6} Q${m - 20},${y + 20} ${m},${y - 2} Q${m + 20},${y + 20} ${m + 40},${y - 6}`} width={9} />;
    case "tongue":
      return (
        <>
          <GlowFill d={`M${m - 16},${y + 2} L${m + 16},${y + 2} L${m + 16},${y + 22} A16,16 0 0 1 ${m - 16},${y + 22} Z`} />
          {ink(`M${m},${y + 8} L${m},${y + 24}`, 5)}
          <GlowStroke d={`M${m - 52},${y - 8} Q${m},${y + 12} ${m + 52},${y - 8}`} width={11} />
        </>
      );
    case "teeth":
      return (
        <>
          <Rect x={m - 42} y={y - 16} width={84} height={32} rx={10} fill="none" stroke={FILL} strokeWidth={8} />
          <Path d={`M${m - 14},${y - 14} L${m - 14},${y + 14} M${m + 14},${y - 14} L${m + 14},${y + 14} M${m - 40},${y} L${m + 40},${y}`} stroke={FILL} strokeWidth={6} />
        </>
      );
    case "kiss": return <GlowStroke d={`M${m - 10},${y - 26} Q${m + 18},${y - 22} ${m},${y - 6} Q${m + 22},${y + 4} ${m - 8},${y + 18}`} width={9} />;
    case "heart": return <GlowFill d={heartPath(m, y, 22)} />;
    case "smirk": return <GlowStroke d={`M${m - 45},${y + 4} Q${m + 10},${y + 14} ${m + 45},${y - 14}`} width={11} />;
    case "triangle": return <GlowFill d={`M${m},${y - 20} L${m + 28},${y + 18} L${m - 28},${y + 18} Z`} />;
    case "drool":
      return (
        <>
          <GlowStroke d={`M${m - 26},${y} L${m + 20},${y}`} width={12} />
          <Circle cx={m + 42} cy={y + 8} r={13} stroke={FILL} strokeWidth={5} fill="none" />
        </>
      );
  }
}

const dropPath = (x: number, y: number, s = 1) =>
  `M${x},${y - 22 * s} C${x + 6 * s},${y - 8 * s} ${x + 14 * s},${y} ${x},${y + 12 * s} C${x - 14 * s},${y} ${x - 6 * s},${y - 8 * s} ${x},${y - 22 * s} Z`;

export function Extras({ list, part }: { list: Extra[]; part: "static" | "float" }) {
  const yB = EYE.cy + EYE.h / 2;
  return (
    <>
      {part === "static" && list.includes("blush") &&
        [EYE.lx - 70, EYE.rx + 22].map((bx) => (
          <Path key={bx} d={[0, 1, 2].map((i) => `M${bx + i * 18},${yB + 34} L${bx + i * 18 + 9},${yB + 18}`).join(" ")} stroke={BLUSH} strokeWidth={6} strokeLinecap="round" />
        ))}
      {part === "static" && list.includes("tears") &&
        [EYE.lx - 40, EYE.rx + 40].map((tx) => <Path key={tx} d={dropPath(tx, yB + 34, 1)} fill={FILL} opacity={0.9} />)}
      {part === "static" && list.includes("stream") &&
        [EYE.lx - 62, EYE.rx + 34].map((sx) => (
          <Path key={sx} d={`M${sx},${yB - 6} L${sx + 28},${yB - 6} L${sx + 32},${VB_H} L${sx - 4},${VB_H} Z`} fill={FILL} opacity={0.85} />
        ))}
      {part === "float" && list.includes("sweat") && <Path d={dropPath(612, 70, 1.1)} fill={FILL} opacity={0.9} />}
      {part === "float" && list.includes("zzz") && (
        <>
          <SvgText x={570} y={70} fontSize={26} fill={FILL} fontFamily={fonts.displayBold}>z</SvgText>
          <SvgText x={592} y={46} fontSize={34} fill={FILL} fontFamily={fonts.displayBold}>z</SvgText>
          <SvgText x={616} y={20} fontSize={42} fill={FILL} fontFamily={fonts.displayBold}>Z</SvgText>
        </>
      )}
      {part === "float" && list.includes("question") && (
        <SvgText x={606} y={66} fontSize={56} fill={FILL} fontFamily={fonts.displayBold}>?</SvgText>
      )}
      {part === "float" && list.includes("anger") && (
        <Path d="M596,46 Q606,46 606,36 M614,36 Q614,46 624,46 M624,54 Q614,54 614,64 M606,64 Q606,54 596,54" stroke={FILL} strokeWidth={6} strokeLinecap="round" fill="none" />
      )}
      {part === "float" && list.includes("sparkle") && (
        <Path d="M622,92 Q624,110 640,112 Q624,114 622,132 Q620,114 604,112 Q620,110 622,92 Z" fill={colors.onSurface} />
      )}
      {part === "float" && list.includes("hearts") && (
        <>
          <Path d={heartPath(570, 44, 11)} fill={BLUSH} />
          <Path d={heartPath(606, 26, 14)} fill={BLUSH} />
        </>
      )}
    </>
  );
}
