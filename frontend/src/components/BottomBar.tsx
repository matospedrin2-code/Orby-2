import { BlurView } from "expo-blur";
import { GearSix, Keyboard, Microphone, Sparkle, SpeakerHigh, SpeakerSlash, Stop } from "phosphor-react-native";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Props = {
  bottom: number;
  capturing: boolean;
  level: number;
  liveOpen: boolean;
  sound: boolean;
  onMic: () => void;
  onLive: () => void;
  onSound: () => void;
  onType: () => void;
  onMenu: () => void;
};

function PressScale({ children, onPress, style, testID }: { children: React.ReactNode; onPress: () => void; style?: any; testID: string }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => (s.value = withSpring(0.9))}
      onPressOut={() => (s.value = withSpring(1))}
      hitSlop={4}
    >
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </Pressable>
  );
}

export function BottomBar(p: Props) {
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = p.capturing ? withRepeat(withTiming(1, { duration: 900 }), -1, false) : withTiming(0);
  }, [p.capturing, ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: p.capturing ? 0.8 - ring.value * 0.8 : 0,
    transform: [{ scale: 1 + ring.value * 0.6 + p.level * 0.3 }],
  }));

  const Bg = Platform.OS === "web" ? View : BlurView;
  return (
    <View style={[styles.wrap, { bottom: p.bottom }]} testID="bottom-bar">
      <Bg intensity={40} tint="dark" style={styles.bar}>
        <View style={styles.micWrap}>
          <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />
          <PressScale onPress={p.onMic} style={[styles.mic, p.capturing && styles.micActive]} testID="mic-button">
            {p.capturing ? (
              <Stop size={24} color={colors.onBrand} weight="fill" />
            ) : (
              <Microphone size={26} color={colors.onBrand} weight="fill" />
            )}
          </PressScale>
        </View>
        <PressScale onPress={p.onLive} style={[styles.live, p.liveOpen && styles.liveOn]} testID="gemini-live-button">
          <Sparkle size={16} color={p.liveOpen ? colors.onBrand : colors.brand} weight="fill" />
          <Text style={[styles.liveTxt, p.liveOpen && { color: colors.onBrand }]}>Gemini Live</Text>
        </PressScale>
        <View style={styles.icons}>
          <PressScale onPress={p.onSound} style={styles.icon} testID="sound-toggle-button">
            {p.sound ? <SpeakerHigh size={22} color={colors.brand} /> : <SpeakerSlash size={22} color={colors.muted} />}
          </PressScale>
          <PressScale onPress={p.onType} style={styles.icon} testID="type-message-button">
            <Keyboard size={22} color={colors.brand} />
          </PressScale>
          <PressScale onPress={p.onMenu} style={styles.icon} testID="settings-button">
            <GearSix size={22} color={colors.brand} />
          </PressScale>
        </View>
      </Bg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: 560,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.glass,
    overflow: "hidden",
  },
  micWrap: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.brand },
  mic: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  micActive: { backgroundColor: colors.error },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  liveOn: { backgroundColor: colors.brand },
  liveTxt: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.brand },
  icons: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 2 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
});
