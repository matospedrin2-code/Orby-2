import { useEffect, useState } from "react";
import Animated, { useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { BrainPanel, type BrainStats } from "@/src/components/hud/BrainPanel";
import { ClockPanel } from "@/src/components/hud/ClockPanel";
import { HudFrame } from "@/src/components/hud/HudFrame";
import { SummaryPanel, type SummaryItem } from "@/src/components/hud/SummaryPanel";

export type HudState =
  | { mode: "relogio" }
  | { mode: "cerebro" }
  | { mode: "resumo"; titulo: string; texto?: string; itens?: SummaryItem[] }
  | null;

type Props = {
  hud: HudState;
  live?: React.ReactNode; // Gemini Live camera takes the panel when open
  width: number;
  left: number;
  top: number;
  maxTextHeight: number;
  clockSize: number;
  stats: BrainStats;
  onClose: () => void;
};

// The holographic panel that slides in next to Orby's face.
export function RightHud({ hud, live, width, left, top, maxTextHeight, clockSize, stats, onClose }: Props) {
  const [last, setLast] = useState<HudState>(hud);
  useEffect(() => {
    if (hud) setLast(hud);
  }, [hud]);
  const open = !!hud || !!live;
  const shown = hud ?? last;

  const slide = useAnimatedStyle(() => ({
    opacity: withTiming(open ? 1 : 0, { duration: 260 }),
    transform: [{ translateX: withSpring(open ? 0 : 80, { damping: 16, stiffness: 120 }) }, { scale: withSpring(open ? 1 : 0.94) }],
  }));

  return (
    <Animated.View style={[{ position: "absolute", left, top, width }, slide]} pointerEvents={open ? "auto" : "none"} testID="hud-panel">
      <HudFrame padding={shown?.mode === "relogio" && !live ? 14 : 22}>
        {live ? live
          : shown?.mode === "resumo" ? <SummaryPanel titulo={shown.titulo} texto={shown.texto} itens={shown.itens} maxHeight={maxTextHeight} onClose={onClose} />
          : shown?.mode === "cerebro" ? <BrainPanel stats={stats} width={width} />
          : <ClockPanel size={clockSize} />}
      </HudFrame>
    </Animated.View>
  );
}
