import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { toArr } from "@/src/expressions";
import { colors, fonts } from "@/src/theme";

export type FaceMode = "resting" | "sleeping" | "listening" | "thinking" | "speaking" | "conversation";

type Props = {
  expression: string;
  mode: FaceMode;
  gazeX: SharedValue<number>;
  gazeY: SharedValue<number>;
  size: number; // base eye width
  shiftX: SharedValue<number>;
  scale: SharedValue<number>;
};

const I = { w: 0, h: 1, r: 2, lidL: 3, lidR: 4, botL: 5, botR: 6, ang: 7, sL: 8, sR: 9, dy: 10, gx: 11, gy: 12 };

function eyeColorFor(expression: string) {
  if (expression === "amoroso") return 1;
  if (expression === "bravo") return 2;
  if (expression === "triste") return 3;
  return 0;
}

export function RobotFace({ expression, mode, gazeX, gazeY, size, shiftX, scale }: Props) {
  const from = useSharedValue(toArr("neutro"));
  const to = useSharedValue(toArr("neutro"));
  const p = useSharedValue(1);
  const blink = useSharedValue(0);
  const breath = useSharedValue(0);
  const bounce = useSharedValue(0);
  const glow = useSharedValue(0.5);
  const tint = useSharedValue(0);

  // Spring morph between expressions (organic overshoot)
  useEffect(() => {
    const cur = from.value.map((a, i) => a + (to.value[i] - a) * p.value);
    from.value = cur;
    to.value = toArr(expression);
    p.value = 0;
    p.value = withSpring(1, { damping: 13, stiffness: 150, mass: 0.9 });
    tint.value = withTiming(eyeColorFor(expression), { duration: 350 });
  }, [expression, from, to, p, tint]);

  // Natural squash blink with occasional double blink
  useEffect(() => {
    if (mode === "sleeping") return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        const one = withSequence(
          withTiming(1, { duration: 70, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 130, easing: Easing.out(Easing.back(2)) }),
        );
        blink.value = Math.random() < 0.22 ? withSequence(one, withDelay(90, one)) : one;
        schedule();
      }, 1800 + Math.random() * 4200);
    };
    schedule();
    return () => clearTimeout(t);
  }, [mode, blink]);

  // Mode driven motion: breathing, speaking bounce, listening glow pulse
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: mode === "sleeping" ? 2600 : 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    bounce.value = mode === "speaking"
      ? withRepeat(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 180 })), -1, false)
      : withTiming(0, { duration: 200 });
    glow.value = mode === "listening" || mode === "conversation"
      ? withRepeat(withTiming(1, { duration: 700 }), -1, true)
      : withTiming(mode === "sleeping" ? 0.25 : 0.55, { duration: 400 });
  }, [mode, breath, bounce, glow]);

  const cur = useDerivedValue(() => from.value.map((a, i) => a + (to.value[i] - a) * p.value));
  const sleeping = mode === "sleeping";

  const faceStyle = useAnimatedStyle(() => {
    const amp = sleeping ? 6 : 2.5;
    return {
      transform: [
        { translateX: shiftX.value },
        { translateY: (breath.value - 0.5) * amp - bounce.value * 5 + cur.value[I.dy] * size },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View style={[styles.face, faceStyle]} testID="robot-face" pointerEvents="none">
      <View style={[styles.row, { gap: size * 0.5 }]}>
        <Eye side="L" size={size} cur={cur} blink={blink} gazeX={gazeX} gazeY={gazeY} glow={glow} tint={tint} bounce={bounce} />
        <Eye side="R" size={size} cur={cur} blink={blink} gazeX={gazeX} gazeY={gazeY} glow={glow} tint={tint} bounce={bounce} />
      </View>
      {sleeping && <Zzz size={size} />}
    </Animated.View>
  );
}

type EyeProps = {
  side: "L" | "R";
  size: number;
  cur: SharedValue<number[]>;
  blink: SharedValue<number>;
  gazeX: SharedValue<number>;
  gazeY: SharedValue<number>;
  glow: SharedValue<number>;
  tint: SharedValue<number>;
  bounce: SharedValue<number>;
};

function Eye({ side, size, cur, blink, gazeX, gazeY, glow, tint, bounce }: EyeProps) {
  const L = side === "L";
  const H = size * 1.15;

  const color = useDerivedValue(() =>
    interpolateColor(tint.value, [0, 1, 2, 3], [colors.brand, colors.eyeLove, colors.eyeAngry, colors.eyeSad]),
  );

  const wrap = useAnimatedStyle(() => {
    const c = cur.value;
    const gx = Math.max(-1, Math.min(1, gazeX.value + c[I.gx]));
    const gy = Math.max(-1, Math.min(1, gazeY.value + c[I.gy]));
    const s = L ? c[I.sL] : c[I.sR];
    // perspective: the eye on the side we look toward grows a bit
    const persp = 1 + (L ? -gx : gx) * 0.07;
    return {
      width: size * c[I.w],
      height: H * c[I.h],
      borderRadius: size * c[I.r],
      backgroundColor: color.value,
      shadowColor: color.value,
      shadowOpacity: 0.5 + glow.value * 0.45,
      transform: [
        { translateX: gx * size * 0.38 },
        { translateY: gy * size * 0.3 },
        { scaleY: s * persp * (1 - blink.value * 0.92) * (1 - bounce.value * 0.06) },
        { scaleX: s * persp * (1 + blink.value * 0.1) },
      ],
    };
  });

  const halo = useAnimatedStyle(() => ({ opacity: 0.05 + glow.value * 0.08, backgroundColor: color.value }));

  const topLid = useAnimatedStyle(() => {
    const c = cur.value;
    const cover = L ? c[I.lidL] : c[I.lidR];
    const h = H * c[I.h];
    return {
      height: h,
      width: size * 2.4,
      left: -size * 0.7,
      top: -h + cover * h * 1.05 - 2,
      transform: [{ rotate: `${L ? c[I.ang] : -c[I.ang]}deg` }],
    };
  });

  const botLid = useAnimatedStyle(() => {
    const c = cur.value;
    const cover = L ? c[I.botL] : c[I.botR];
    const h = H * c[I.h];
    const d = size * 1.7;
    return { width: d, height: d, borderRadius: d / 2, left: (size * c[I.w] - d) / 2, top: h - cover * h * 1.1 };
  });

  return (
    <View style={{ width: size, height: H, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[styles.halo, { width: size * 1.18, height: H * 1.18, borderRadius: size * 0.45 }, halo]} />
      <Animated.View style={[styles.eye, wrap]} testID={`robot-eye-${side}`}>
        <Animated.View style={[styles.lid, topLid]} />
        <Animated.View style={[styles.lid, botLid]} />
      </Animated.View>
    </View>
  );
}

function Zzz({ size }: { size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [t]);
  const a = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ translateY: -t.value * size * 0.8 }, { translateX: t.value * 20 }] }));
  return (
    <Animated.Text style={[styles.z, { right: -size * 0.2, top: -size * 0.3, fontSize: size * 0.28 }, a]}>z z</Animated.Text>
  );
}

const styles = StyleSheet.create({
  face: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  halo: { position: "absolute" },
  eye: { overflow: "hidden", shadowOffset: { width: 0, height: 0 }, shadowRadius: 22, elevation: 0 },
  lid: { position: "absolute", backgroundColor: colors.surface },
  z: { position: "absolute", color: colors.brand, fontFamily: fonts.displayBold },
});
