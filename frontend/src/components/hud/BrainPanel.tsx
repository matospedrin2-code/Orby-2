import { Brain, Database, Globe, Graph, InfinityIcon } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Line, Path } from "react-native-svg";
import { colors, fonts, spacing } from "@/src/theme";

export type BrainStats = { neural: number; internet: number; database: number; context: number };

// deterministic pseudo random so the brain network is always the same shape
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const BRAIN =
  "M40,100 C18,94 14,68 30,55 C28,34 50,20 70,24 C82,8 112,6 126,19 C146,10 172,24 174,45 C192,56 192,86 176,96 C178,112 160,124 146,116 C140,130 118,132 108,122 C98,128 88,126 84,118 C68,124 50,120 48,108 C44,106 42,104 40,100 Z";

function NeuralBrain({ size }: { size: number }) {
  const { nodes, edges } = useMemo(() => {
    const r = rng(42);
    const pts: { x: number; y: number; s: number }[] = [];
    while (pts.length < 46) {
      const x = 28 + r() * 150;
      const y = 18 + r() * 112;
      const dx = (x - 102) / 80;
      const dy = (y - 70) / 52;
      if (dx * dx + dy * dy < 1) pts.push({ x, y, s: 1.2 + r() * 2.4 });
    }
    const e: [number, number][] = [];
    pts.forEach((p, i) => {
      const near = pts
        .map((q, j) => ({ j, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      near.forEach((n) => e.push([i, n.j]));
    });
    return { nodes: pts, edges: e };
  }, []);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.65 }));
  const h = size * 0.8;
  return (
    <View style={{ width: size, height: h }} testID="hud-neural-brain">
      <Svg width={size} height={h} viewBox="0 0 200 160" style={StyleSheet.absoluteFill}>
        <Path d={BRAIN} fill={colors.brandTertiary} stroke={colors.hudBlue} strokeWidth={1.4} />
        <Path d="M112,122 C118,136 124,146 120,156" stroke={colors.hudBlue} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Ellipse cx={102} cy={74} rx={98} ry={34} stroke={colors.brand} strokeOpacity={0.45} strokeWidth={1} fill="none" transform="rotate(-18 102 74)" />
        <Ellipse cx={102} cy={74} rx={92} ry={52} stroke={colors.brand} strokeOpacity={0.3} strokeWidth={1} fill="none" transform="rotate(24 102 74)" />
        <G>
          {edges.map(([a, b], i) => (
            <Line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={colors.brand} strokeOpacity={0.35} strokeWidth={0.7} />
          ))}
          {nodes.map((n, i) => <Circle key={i} cx={n.x} cy={n.y} r={n.s * 0.6} fill={colors.eyeFill} />)}
        </G>
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, glow]}>
        <Svg width={size} height={h} viewBox="0 0 200 160">
          {nodes.filter((_, i) => i % 3 === 0).map((n, i) => (
            <G key={i}>
              <Circle cx={n.x} cy={n.y} r={n.s * 2.4} fill={colors.brand} opacity={0.25} />
              <Circle cx={n.x} cy={n.y} r={n.s * 0.9} fill={colors.onSurface} />
            </G>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

function StatRow({ icon, title, sub, value, testID }: { icon: React.ReactNode; title: string; sub: string; value: number; testID: string }) {
  const [w, setW] = useState(0);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(value / 100, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value, fill]);
  const bar = useAnimatedStyle(() => ({ width: w * fill.value }));
  return (
    <View style={styles.stat} testID={testID}>
      <View style={styles.icon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.barRow}>
          <View style={styles.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.fill, bar]} />
          </View>
          <Text style={styles.pct}>{`${Math.round(value)}%`}</Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
    </View>
  );
}

// "Cérebro" panel: shown while Orby is thinking, or when you ask for his status.
export function BrainPanel({ stats, width }: { stats: BrainStats; width: number }) {
  const brain = Math.min(width * 0.38, 190);
  const ic = 26;
  return (
    <View testID="hud-brain">
      <View style={styles.row}>
        <NeuralBrain size={brain} />
        <View style={styles.stats}>
          <StatRow testID="hud-stat-neural" icon={<Brain size={ic} color={colors.brand} />} title="Conexões neurais" sub="Aprendizado contínuo" value={stats.neural} />
          <StatRow testID="hud-stat-internet" icon={<Globe size={ic} color={colors.brand} />} title="Acesso à internet" sub="Explorando e coletando dados" value={stats.internet} />
          <StatRow testID="hud-stat-database" icon={<Database size={ic} color={colors.brand} />} title="Banco de dados" sub="Atualizando informações" value={stats.database} />
          <StatRow testID="hud-stat-context" icon={<Graph size={ic} color={colors.brand} />} title="Processamento de contexto" sub="Analisando e conectando ideias" value={stats.context} />
        </View>
      </View>
      <View style={styles.footer}>
        <Svg width={90} height={22} viewBox="0 0 90 22">
          <Path d="M0,18 L10,18 Q16,18 20,6 Q24,-2 28,14 Q32,22 38,12 Q42,8 46,16 L90,16" stroke={colors.brand} strokeWidth={1.5} fill="none" />
        </Svg>
        <View style={styles.footLine} />
        <Text style={styles.footTxt}>Mais conexões = mais aprendizado</Text>
        <InfinityIcon size={20} color={colors.brand} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stats: { flex: 1, gap: spacing.sm },
  stat: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  icon: { width: 30, alignItems: "center", paddingTop: 2 },
  statTitle: { fontFamily: fonts.text, fontSize: 13, color: colors.brand, fontWeight: "600" },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: 3 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(0, 240, 255, 0.15)", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  pct: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.brand, width: 34, textAlign: "right" },
  sub: { fontFamily: fonts.text, fontSize: 11, color: colors.hudText, opacity: 0.85 },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingRight: 90 },
  footLine: { flex: 1, height: 1, backgroundColor: colors.border },
  footTxt: { fontFamily: fonts.text, fontSize: 11, color: colors.brand },
});
