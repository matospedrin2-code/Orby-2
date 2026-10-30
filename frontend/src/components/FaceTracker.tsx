// On-device instant face tracking (ML Kit via VisionCamera v5).
// Needs an installed build; in Expo Go the native modules are missing, so this reports unavailable.
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "@/src/theme";

let VC: any = null;
let FD: any = null;
try {
  VC = require("react-native-vision-camera");
  FD = require("react-native-vision-camera-face-detector");
  if (!VC?.useCameraPermission || !FD?.Camera) {
    VC = null;
    FD = null;
  }
} catch {
  VC = null;
  FD = null;
}

export const faceTrackingAvailable = !!(VC && FD);

export type TrackerPermission = { available: boolean; granted: boolean; canAsk: boolean; request: () => Promise<boolean> };

function useNativePermission(): TrackerPermission {
  const p = VC.useCameraPermission();
  return { available: true, granted: p.hasPermission, canAsk: p.canRequestPermission, request: p.requestPermission };
}
function useNoPermission(): TrackerPermission {
  return { available: false, granted: false, canAsk: false, request: async () => false };
}
export const useTrackerPermission: () => TrackerPermission = faceTrackingAvailable ? useNativePermission : useNoPermission;

type Props = {
  active: boolean;
  granted: boolean;
  mirror: boolean;
  preview: boolean;
  onFace: (x: number, y: number, smiling: number, closeness: number) => void;
};

export function FaceTracker(props: Props) {
  if (!faceTrackingAvailable || !props.granted) return null;
  return <NativeTracker {...props} />;
}

function NativeTracker({ active, mirror, preview, onFace }: Props) {
  const cb = useRef(onFace);
  useEffect(() => {
    cb.current = onFace;
  }, [onFace]);

  const handle = useCallback(
    (faces: any[]) => {
      if (!faces?.length) return;
      // biggest face = the person closest to Orby
      let f = faces[0];
      for (const x of faces) if (x.bounds.width * x.bounds.height > f.bounds.width * f.bounds.height) f = x;
      let fw = f.frameWidth || 1;
      let fh = f.frameHeight || 1;
      let cx = (f.bounds.x + f.bounds.width / 2) / fw;
      let cy = (f.bounds.y + f.bounds.height / 2) / fh;
      // sensor frames can arrive landscape while the phone is portrait
      if (fw > fh) {
        [cx, cy] = [cy, cx];
        [fw, fh] = [fh, fw];
      }
      let nx = -(cx * 2 - 1); // unmirrored front camera: user's left is image right
      if (mirror) nx = -nx;
      const ny = cy * 2 - 1;
      const closeness = f.bounds.width / fw;
      cb.current(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)), f.smilingProbability ?? 0, closeness);
    },
    [mirror],
  );

  const Cam = FD.Camera;
  return (
    <View style={[styles.preview, !preview && styles.hidden]} pointerEvents="none" testID="face-tracker-preview">
      <Cam
        style={StyleSheet.absoluteFill}
        device="front"
        isActive={active}
        performanceMode="fast"
        runClassifications
        trackingEnabled
        minFaceSize={0.12}
        onFacesDetected={handle}
        onError={(e: unknown) => console.warn("[tracker]", e)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: 66,
    height: 88,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
  },
  hidden: { opacity: 0.01, width: 2, height: 2, borderWidth: 0 },
});
