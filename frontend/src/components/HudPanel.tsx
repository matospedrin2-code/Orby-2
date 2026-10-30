import { getBatteryLevelAsync } from "expo-battery";
import { Brain, BatteryHigh, BatteryLow, BatteryMedium, WifiHigh, X } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ScrollViewInstance } from "react-native";
import Animated, { useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Polygon, Stop } from "react-native-svg";
import { colors, fonts, spacing } from "@/src/theme";

export type HudState = { mode: "relogio" } | { mode: "resumo"; titulo: string; texto: string } | null;

type Props = { hud: HudState; width: number; maxHeight: number; top: number; onClose: () => void };

export function useBatteryPct(): number | null {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const level = await getBatteryLevelAsync();
        if (alive) setPct(level == null || level < 0 ? null : Math.round(level * 100));
      } catch {
        if (alive) setPct(null);
      }
    };
    read();
    const t = setInterval(read, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return pct;
}

function chamfer(w: number, h: number) {
  return `25,1 ${w - 45},1 ${w - 1},25 ${w - 1},${h - 18} ${w - 30},${h - 1} 18,${h - 1} 1,${h - 18} 1,25`;
}

export function HudPanel({ hud, width, maxHeight, top, onClose }: Props) {
  const [box, setBox] = useState({ w: width, h: 120 });
  const [last, setLast] = useState<HudState>(hud);
  const open = !!hud;

  useEffect(() => {
    if (hud) setLast(hud);
  }, [hud]);

  const slide = useAnimatedStyle(() => ({
    opacity: withTiming(open ? 1 : 0, { duration: 260 }),
    transform: [{ translateX: withSpring(open ? 0 : -width - 60, { damping: 16, stiffness: 120 }) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (Math.abs(w - box.w) > 1 || Math.abs(h - box.h) > 1) setBox({ w, h });
  };

  const shown = hud ?? last;

  return (
    <Animated.View
      style={[styles.wrap, { width, top }, slide]}
      pointerEvents={open ? "auto" : "none"}
      testID="hud-panel"
    >
      <View onLayout={onLayout} style={styles.inner}>
        <Svg style={StyleSheet.absoluteFill} width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id="hudbg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.hudGradientStart} />
              <Stop offset="1" stopColor={colors.hudGradientEnd} />
            </LinearGradient>
          </Defs>
          <Polygon points={chamfer(box.w, box.h)} fill="url(#hudbg)" stroke={colors.hudGlow} strokeWidth={8} strokeOpacity={0.35} />
          <Polygon points={chamfer(box.w, box.h)} fill="transparent" stroke={colors.brand} strokeWidth={2} />
        </Svg>
        <View style={styles.wifi} testID="hud-wifi-icon">
          <WifiHigh size={20} color={colors.brand} weight="bold" />
        </View>
        {shown?.mode === "resumo" ? (
          <Summary titulo={shown.titulo} texto={shown.texto} maxHeight={maxHeight} onClose={onClose} />
        ) : (
          <Clock onClose={onClose} />
        )}
        <View style={styles.stripes}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.stripe} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function Clock({ onClose }: { onClose: () => void }) {
  const [now, setNow] = useState(new Date());
  const batt = useBatteryPct();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const BIcon = batt == null || batt > 60 ? BatteryHigh : batt > 25 ? BatteryMedium : BatteryLow;
  return (
    <Pressable onPress={onClose} style={styles.clockRow} testID="hud-clock">
      <Text style={styles.clock} testID="hud-clock-time">{`${hh}:${mm}`}</Text>
      <View style={styles.batt}>
        <BIcon size={26} color={colors.brand} weight="fill" />
        <Text style={styles.battTxt} testID="hud-battery">{batt == null ? "--" : `${batt}%`}</Text>
      </View>
    </Pressable>
  );
}

function Summary({ titulo, texto, maxHeight, onClose }: { titulo: string; texto: string; maxHeight: number; onClose: () => void }) {
  const ref = useRef<ScrollViewInstance>(null);
  const y = useRef(0);
  const max = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    y.current = 0;
    ref.current?.scrollTo({ y: 0, animated: false });
    let wait = 40; // ~2s pause before auto rolling
    const t = setInterval(() => {
      if (paused.current || max.current <= 0) return;
      if (wait > 0) {
        wait--;
        return;
      }
      y.current += 0.7;
      if (y.current >= max.current) {
        y.current = max.current;
        wait = 60;
        setTimeout(() => {
          y.current = 0;
          ref.current?.scrollTo({ y: 0, animated: true });
        }, 2500);
      }
      ref.current?.scrollTo({ y: y.current, animated: false });
    }, 50);
    return () => clearInterval(t);
  }, [texto]);

  return (
    <View testID="hud-summary">
      <View style={styles.sumHead}>
        <Brain size={22} color={colors.brand} weight="duotone" />
        <Text style={styles.sumTitle} numberOfLines={2} testID="hud-summary-title">{titulo}</Text>
        <Pressable onPress={onClose} hitSlop={12} style={styles.close} testID="hud-close-button">
          <X size={18} color={colors.brand} weight="bold" />
        </Pressable>
      </View>
      <ScrollView
        ref={ref}
        style={{ maxHeight }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => (max.current = Math.max(0, h - maxHeight))}
        onScrollBeginDrag={() => (paused.current = true)}
        onScrollEndDrag={(e) => {
          y.current = e.nativeEvent.contentOffset.y;
          setTimeout(() => (paused.current = false), 2500);
        }}
      >
        <Text style={styles.sumText} testID="hud-summary-text">{texto}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16 },
  inner: { padding: spacing.xl, paddingBottom: spacing.xl + 6 },
  wifi: { position: "absolute", top: 14, right: 22 },
  stripes: { position: "absolute", bottom: 10, right: 20, flexDirection: "row", gap: 5 },
  stripe: {
    width: 14,
    height: 4,
    backgroundColor: colors.brand,
    transform: [{ skewX: "-32deg" }],
    shadowColor: colors.brand,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  clockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: spacing.lg },
  clock: {
    fontFamily: fonts.displayBold,
    fontSize: 64,
    lineHeight: 70,
    color: colors.brand,
    textShadowColor: "rgba(0, 240, 255, 0.7)",
    textShadowRadius: 15,
  },
  batt: { alignItems: "flex-end", marginTop: spacing.md },
  battTxt: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.brand },
  sumHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    paddingRight: 36,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 240, 255, 0.25)",
  },
  sumTitle: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.brand,
    textShadowColor: colors.brand,
    textShadowRadius: 8,
  },
  close: { position: "absolute", right: 0, top: -2, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sumText: { fontFamily: fonts.text, fontSize: 14, lineHeight: 22.4, color: colors.hudText },
});
