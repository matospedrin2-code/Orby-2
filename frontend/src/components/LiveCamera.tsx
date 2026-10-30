import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { CameraRotate, Eye, Sparkle, X } from "phosphor-react-native";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { colors, fonts, radius, spacing } from "@/src/theme";

export type LiveCameraHandle = { snapshot: () => Promise<string | null> };

type Props = { busy: boolean; onClose: () => void; onDescribe: () => void; onReady: () => void };

// Gemini Live: Orby looks through the camera and describes what he sees.
export const LiveCamera = forwardRef<LiveCameraHandle, Props>(function LiveCamera({ busy, onClose, onDescribe, onReady }, ref) {
  const [perm, request] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const cam = useRef<CameraView>(null);
  const ready = useRef(false);

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      if (!cam.current || !ready.current) return null;
      try {
        const pic = await cam.current.takePictureAsync({ base64: true, quality: 0.35, shutterSound: false, imageType: "jpg" });
        if (!pic) return null;
        return pic.base64 ?? (pic.uri?.startsWith("data:") ? pic.uri.split(",")[1] : null);
      } catch (e) {
        console.warn("[live] snapshot failed", e);
        return null;
      }
    },
  }));

  const granted = perm?.granted;

  return (
    <Animated.View entering={FadeInUp.springify()} exiting={FadeOutUp} style={styles.card} testID="gemini-live-panel">
      <View style={styles.head}>
        <Sparkle size={16} color={colors.brand} weight="fill" />
        <Text style={styles.title}>GEMINI LIVE</Text>
        <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn} testID="gemini-live-close-button">
          <X size={18} color={colors.brand} weight="bold" />
        </Pressable>
      </View>
      <View style={styles.viewport}>
        {!perm ? (
          <ActivityIndicator color={colors.brand} />
        ) : granted ? (
          <CameraView
            ref={cam}
            style={StyleSheet.absoluteFill}
            facing={facing}
            onCameraReady={() => {
              ready.current = true;
              setTimeout(onReady, 400);
            }}
            testID="gemini-live-camera"
          />
        ) : (
          <View style={styles.permBox}>
            <Eye size={28} color={colors.brand} />
            <Text style={styles.permTxt}>
              Deixa o Orby enxergar pela câmera para descrever o que está na sua frente.
            </Text>
            {perm.canAskAgain ? (
              <Pressable style={styles.permBtn} onPress={request} testID="gemini-live-allow-camera-button">
                <Text style={styles.permBtnTxt}>Permitir câmera</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.permBtn} onPress={() => Linking.openSettings()} testID="gemini-live-open-settings-button">
                <Text style={styles.permBtnTxt}>Abrir Ajustes</Text>
              </Pressable>
            )}
          </View>
        )}
        {busy && (
          <View style={styles.scan} pointerEvents="none">
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.scanTxt}>ANALISANDO...</Text>
          </View>
        )}
      </View>
      {granted && (
        <View style={styles.actions}>
          <Pressable style={styles.iconBtn} onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} testID="gemini-live-flip-button">
            <CameraRotate size={20} color={colors.brand} />
          </Pressable>
          <Pressable style={[styles.describe, busy && { opacity: 0.5 }]} disabled={busy} onPress={onDescribe} testID="gemini-live-describe-button">
            <Text style={styles.describeTxt}>O que você vê?</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: radius.md,
    padding: spacing.sm,
    shadowColor: colors.brand,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm, paddingLeft: spacing.xs },
  title: { flex: 1, fontFamily: fonts.displayBold, color: colors.brand, fontSize: 14, letterSpacing: 2 },
  viewport: { height: 260, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  permBox: { padding: spacing.md, alignItems: "center", gap: spacing.sm },
  permTxt: { fontFamily: fonts.text, color: colors.hudText, fontSize: 13, textAlign: "center", lineHeight: 19 },
  permBtn: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 40, justifyContent: "center" },
  permBtnTxt: { fontFamily: fonts.displayBold, color: colors.onBrand, fontSize: 15 },
  scan: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,9,15,0.45)", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  scanTxt: { fontFamily: fonts.displayBold, color: colors.brand, letterSpacing: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  describe: { flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
  describeTxt: { fontFamily: fonts.displayBold, color: colors.brand, fontSize: 15 },
});
