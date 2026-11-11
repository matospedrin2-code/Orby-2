import { Sparkle, SpeakerHigh, SpeakerSlash } from "phosphor-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Props = {
  left: number;
  bottom: number;
  status: string;
  active: boolean; // capturing voice
  level: number;
  sound: boolean;
  liveOpen: boolean;
  onMic: () => void;
  onSound: () => void;
  onLive: () => void;
};

function Dot({ i, wave, active, level }: { i: number; wave: SharedValue<number>; active: boolean; level: number }) {
  const s = useAnimatedStyle(() => {
    const lit = active ? i < Math.max(1, Math.round(level * 5)) : Math.abs(((wave.value * 5) | 0) - i) < 1;
    return { opacity: withTiming(lit ? 1 : 0.35, { duration: 120 }), transform: [{ scale: withTiming(lit ? 1.15 : 1, { duration: 120 }) }] };
  });
  return <Animated.View style={[styles.dot, s]} />;
}

function Pill({ children, onPress, active, testID }: { children: React.ReactNode; onPress: () => void; active?: boolean; testID: string }) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable testID={testID} onPress={onPress} onPressIn={() => (sc.value = withSpring(0.92))} onPressOut={() => (sc.value = withSpring(1))}>
      <Animated.View style={[styles.pill, active && styles.pillOn, a]}>{children}</Animated.View>
    </Pressable>
  );
}

// Bottom-left controls: listening dots (tap to talk), sound and Gemini Live.
export function ControlsBar(p: Props) {
  const wave = useSharedValue(0);
  useEffect(() => {
    wave.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false);
  }, [wave]);
  return (
    <View style={[styles.wrap, { left: p.left, bottom: p.bottom }]} testID="controls-bar">
      <Pressable onPress={p.onMic} style={styles.listen} hitSlop={8} testID="mic-button">
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Dot key={i} i={i} wave={wave} active={p.active} level={p.level} />
          ))}
        </View>
        <Text style={styles.status} numberOfLines={1} testID="status-text">{p.status}</Text>
      </Pressable>
      <Pill onPress={p.onSound} testID="sound-toggle-button">
        {p.sound ? <SpeakerHigh size={22} color={colors.onSurface} weight="fill" /> : <SpeakerSlash size={22} color={colors.muted} weight="fill" />}
        <Text style={styles.pillTxt}>Som</Text>
      </Pill>
      <Pill onPress={p.onLive} active={p.liveOpen} testID="gemini-live-button">
        <Sparkle size={18} color={p.liveOpen ? colors.onBrand : colors.brand} weight="fill" />
        <Text style={[styles.pillTxt, { color: p.liveOpen ? colors.onBrand : colors.brand }]}>Gemini Live</Text>
      </Pill>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", flexDirection: "row", alignItems: "center", gap: spacing.lg },
  listen: { alignItems: "center", minWidth: 92, minHeight: 48, justifyContent: "center" },
  dots: { flexDirection: "row", gap: 5, marginBottom: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.onSurface },
  status: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.onSurface, letterSpacing: 0.3 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: "rgba(0, 240, 255, 0.28)",
    backgroundColor: colors.glass,
  },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillTxt: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.onSurface },
});
