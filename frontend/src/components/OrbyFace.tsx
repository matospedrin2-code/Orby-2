import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { G } from "react-native-svg";
import { BLINKABLE, NEGATIVE_MOUTHS, getFace, type FaceDef } from "@/src/faceCatalog";
import { Brows, EYE, Extras, EyeShape, MOUTH, Mouth, VB_H, VB_W } from "@/src/components/FaceParts";

export type FaceMode = "resting" | "sleeping" | "listening" | "thinking" | "speaking" | "conversation";

type Props = {
  expression: string;
  mode: FaceMode;
  gazeX: SharedValue<number>;
  gazeY: SharedValue<number>;
  width: number;
  shiftX: SharedValue<number>;
  shiftY: SharedValue<number>;
};

const EYE_ORIGIN = `50% ${((EYE.cy / VB_H) * 100).toFixed(1)}%`;

export function OrbyFace({ expression, mode, gazeX, gazeY, width, shiftX, shiftY }: Props) {
  const height = (width * VB_H) / VB_W;
  const target = getFace(expression);
  const [face, setFace] = useState<FaceDef>(target);
  const [talkOpen, setTalkOpen] = useState(false);
  const blink = useSharedValue(0);
  const pop = useSharedValue(1);
  const breath = useSharedValue(0);
  const bounce = useSharedValue(0);
  const float = useSharedValue(0);
  const faceRef = useRef(face);
  faceRef.current = face;

  // Swap expressions mid-blink, like a person changing face
  useEffect(() => {
    if (target.key === faceRef.current.key) return;
    const canBlink = BLINKABLE.has(faceRef.current.eyeL) && BLINKABLE.has(target.eyeL);
    if (!canBlink) {
      setFace(target);
      pop.value = withSequence(withTiming(0.95, { duration: 80 }), withSpring(1, { damping: 9, stiffness: 180 }));
      return;
    }
    blink.value = withSequence(withTiming(1, { duration: 75 }), withTiming(0, { duration: 150, easing: Easing.out(Easing.back(1.6)) }));
    const t = setTimeout(() => {
      setFace(target);
      pop.value = withSequence(withTiming(0.96, { duration: 60 }), withSpring(1, { damping: 9, stiffness: 200 }));
    }, 75);
    return () => clearTimeout(t);
  }, [target.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Natural random blinking with occasional double blinks
  useEffect(() => {
    if (mode === "sleeping") return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        if (BLINKABLE.has(faceRef.current.eyeL)) {
          const one = withSequence(
            withTiming(1, { duration: 70, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 140, easing: Easing.out(Easing.back(1.8)) }),
          );
          blink.value = Math.random() < 0.22 ? withSequence(one, withDelay(90, one)) : one;
        }
        schedule();
      }, 1800 + Math.random() * 4200);
    };
    schedule();
    return () => clearTimeout(t);
  }, [mode, blink]);

  // Talking mouth: opens and closes in an irregular rhythm while Orby speaks
  useEffect(() => {
    if (mode !== "speaking") {
      setTalkOpen(false);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      setTalkOpen((v) => !v);
      t = setTimeout(step, 90 + Math.random() * 160);
    };
    step();
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: mode === "sleeping" ? 2800 : 1900, easing: Easing.inOut(Easing.sin) }), -1, true);
    bounce.value = mode === "speaking"
      ? withRepeat(withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 190 })), -1, false)
      : withTiming(0, { duration: 200 });
  }, [mode, breath, bounce]);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [float]);

  const sleeping = mode === "sleeping";
  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shiftX.value },
      { translateY: shiftY.value + (breath.value - 0.5) * (sleeping ? 7 : 3) - bounce.value * 3 },
      { scale: pop.value * (1 + (sleeping ? breath.value * 0.015 : 0)) },
    ],
  }));
  const eyesStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: gazeX.value * width * 0.055 },
      { translateY: gazeY.value * width * 0.035 },
      { scaleY: 1 - blink.value * 0.92 },
      { scaleX: 1 + blink.value * 0.08 },
    ],
  }));
  const browStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: gazeX.value * width * 0.05 }, { translateY: gazeY.value * width * 0.025 + blink.value * 6 }],
  }));
  const mouthStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: gazeX.value * width * 0.03 }, { translateY: gazeY.value * width * 0.02 }],
  }));
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -float.value * 6 }], opacity: 0.75 + float.value * 0.25 }));

  const mouth = mode === "speaking" && talkOpen ? (NEGATIVE_MOUTHS.has(face.mouth) ? "oval" : "openD") : face.mouth;
  const box = { width, height };
  const vb = `0 0 ${VB_W} ${VB_H}`;

  return (
    <Animated.View style={[box, faceStyle]} testID="robot-face" pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: EYE_ORIGIN }, eyesStyle]}>
        <Svg {...box} viewBox={vb}>
          <EyeShape kind={face.eyeL} side="L" />
          <EyeShape kind={face.eyeR} side="R" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, browStyle]}>
        <Svg {...box} viewBox={vb}>
          <Brows kind={face.brow} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, mouthStyle]}>
        <Animated.View key={mouth} entering={FadeIn.duration(90)} exiting={FadeOut.duration(70)} style={StyleSheet.absoluteFill}>
          <Svg {...box} viewBox={vb}>
            <G transform={`translate(${MOUTH.x} ${MOUTH.y}) scale(${face.mouth === "bigSmile" ? 1 : 1.3}) translate(${-MOUTH.x} ${-MOUTH.y})`}>
              <Mouth kind={mouth} />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
      {face.extras.length > 0 && (
        <View style={StyleSheet.absoluteFill} testID={`face-extras-${face.key}`}>
          <Animated.View key={`s-${face.key}`} entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
            <Svg {...box} viewBox={vb}>
              <Extras list={face.extras} part="static" />
            </Svg>
          </Animated.View>
          <Animated.View key={`f-${face.key}`} entering={FadeIn.duration(220)} style={[StyleSheet.absoluteFill, floatStyle]}>
            <Svg {...box} viewBox={vb}>
              <Extras list={face.extras} part="float" />
            </Svg>
          </Animated.View>
        </View>
      )}
      <View testID={`face-expression-${face.key}`} style={styles.marker} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({ marker: { position: "absolute", width: 1, height: 1, opacity: 0 } });
