import { Eye, Microphone, Timer as TimerIcon, X } from "phosphor-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, BackHandler, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { openAction, actionUrl } from "@/src/actions";
import {
  DEFAULT_SETTINGS,
  PAUSE_MS,
  clearMemories,
  fetchTts,
  getSessionId,
  loadSettings,
  saveSettings,
  sendChat,
  sendVision,
  sendVoice,
  type OrbyReply,
  type Settings,
} from "@/src/api";
import { playOrbyVoice, stopAudio } from "@/src/audio";
import { BottomBar } from "@/src/components/BottomBar";
import { FaceTracker, faceTrackingAvailable, useTrackerPermission } from "@/src/components/FaceTracker";
import { HistorySheet } from "@/src/components/HistorySheet";
import { HudPanel, useBatteryPct, type HudState } from "@/src/components/HudPanel";
import { LiveCamera, type LiveCameraHandle } from "@/src/components/LiveCamera";
import { RobotFace, type FaceMode } from "@/src/components/RobotFace";
import { SettingsSheet } from "@/src/components/SettingsSheet";
import { TypeSheet } from "@/src/components/TypeSheet";
import { useVoiceLoop } from "@/src/hooks/useVoiceLoop";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Mode = "resting" | "sleeping" | "conversation" | "thinking" | "speaking";
const CONVERSATION_MS = 25000;
const SLEEP_AFTER_MS = 120000;

export default function OrbyScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [session, setSession] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("resting");
  const [expression, setExpression] = useState("feliz");
  const [hud, setHud] = useState<HudState>(null);
  const [caption, setCaption] = useState<{ who: "user" | "orby"; text: string }>({ who: "orby", text: "Oi! Eu sou o Orby. Diga “Orby” e fale comigo." });
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "settings" | "history" | "type">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [timer, setTimer] = useState<{ end: number; label: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [hideMicCard, setHideMicCard] = useState(false);
  const [hideEyeCard, setHideEyeCard] = useState(false);

  const battery = useBatteryPct();
  const tracker = useTrackerPermission();

  const ctx = useRef({ session, settings, battery });
  ctx.current = { session, settings, battery };
  const liveOpenRef = useRef(false);
  liveOpenRef.current = liveOpen;
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const convUntil = useRef(0);
  const lastActivity = useRef(Date.now());
  const lastFaceAt = useRef(0);
  const lastSmileAt = useRef(0);
  const busyReply = useRef(false);
  const exprTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef = useRef<LiveCameraHandle>(null);
  const loopRef = useRef<ReturnType<typeof useVoiceLoop> | null>(null);

  const gazeX = useSharedValue(0);
  const gazeY = useSharedValue(0);
  const shiftX = useSharedValue(0);
  const faceScale = useSharedValue(1);

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    (async () => {
      const [id, s] = await Promise.all([getSessionId(), loadSettings()]);
      setSession(id);
      setSettings(s);
      setLoaded(true);
    })();
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const setTempExpression = useCallback((e: string, ms = 7000) => {
    setExpression(e);
    if (exprTimer.current) clearTimeout(exprTimer.current);
    exprTimer.current = setTimeout(() => setExpression(modeRef.current === "sleeping" ? "sono" : "neutro"), ms);
  }, []);

  // ---------------------------------------------------------------- reply pipeline
  const applyReply = useCallback(async (res: OrbyReply, userText?: string) => {
    if (busyReply.current) return;
    busyReply.current = true;
    lastActivity.current = Date.now();
    if (userText) setCaption({ who: "user", text: userText });
    setTempExpression(res.expressao || "neutro", 9000);

    if (res.hud?.modo === "relogio") setHud({ mode: "relogio" });
    else if (res.hud?.modo === "fechar") setHud(null);
    else if (res.hud?.texto) setHud({ mode: "resumo", titulo: res.hud.titulo || "Resumo", texto: res.hud.texto });

    const acao = res.acao;
    if (acao?.tipo === "timer") {
      const secs = Math.max(1, Number(acao.segundos) || 60);
      setTimer({ end: Date.now() + secs * 1000, label: acao.rotulo || "timer" });
    }

    setTimeout(() => setCaption({ who: "orby", text: res.fala }), userText ? 600 : 0);

    if (res.audio_url && ctx.current.settings.sound) {
      await loopRef.current?.pause();
      try {
        await playOrbyVoice(res.audio_url, () => setMode("speaking"));
      } catch (e) {
        console.warn("[voice] playback failed", e);
        showToast("Não consegui tocar minha voz. Veja a legenda.");
      }
    }

    busyReply.current = false;
    if (acao?.tipo === "dormir") {
      convUntil.current = 0;
      setMode("sleeping");
      setExpression("sono");
    } else {
      convUntil.current = Date.now() + CONVERSATION_MS;
      setMode("conversation");
    }
    loopRef.current?.resume();
    if (acao && actionUrl(acao)) {
      const ok = await openAction(acao);
      if (!ok) showToast("Não consegui abrir esse app no aparelho.");
    }
  }, [setTempExpression, showToast]);

  const handleUtterance = useCallback(async (uri: string, manual: boolean) => {
    const requireWake = !manual && Date.now() > convUntil.current;
    if (!requireWake) {
      setMode("thinking");
      setExpression("pensando");
    }
    try {
      const img = liveOpenRef.current ? await liveRef.current?.snapshot() : null;
      const res = await sendVoice(ctx.current, uri, requireWake, img);
      if (!res.woke) {
        if (!requireWake) {
          showToast(res.reason === "no_wake" ? "Não entendi, pode repetir?" : "Não ouvi direito, fala de novo?");
          setTempExpression("confuso", 2500);
          setMode(Date.now() < convUntil.current ? "conversation" : "resting");
        }
        return;
      }
      if (modeRef.current === "sleeping") setExpression("surpreso");
      await applyReply(res as OrbyReply, res.transcript);
    } catch (e: any) {
      console.warn("[turn] failed", e);
      if (!requireWake) {
        showToast(e?.message ?? "Falha na conexão");
        setTempExpression("confuso", 3000);
        setMode("resting");
      }
    }
  }, [applyReply, setTempExpression, showToast]);

  const loop = useVoiceLoop({
    enabled: loaded && settings.alwaysListen && !!session,
    silenceMs: PAUSE_MS[settings.pause],
    onUtterance: handleUtterance,
  });
  loopRef.current = loop;

  const sendTyped = useCallback(async (text: string) => {
    setMode("thinking");
    setExpression("pensando");
    setCaption({ who: "user", text });
    try {
      const res = await sendChat(ctx.current, text);
      await applyReply(res);
    } catch (e: any) {
      showToast(e?.message ?? "Falha na conexão");
      setTempExpression("confuso", 3000);
      setMode("resting");
    }
  }, [applyReply, setTempExpression, showToast]);

  const describe = useCallback(async (question = "O que você está vendo agora?") => {
    if (liveBusy) return;
    setLiveBusy(true);
    setMode("thinking");
    setExpression("curioso");
    try {
      const img = await liveRef.current?.snapshot();
      if (!img) {
        showToast("A câmera ainda não está pronta.");
        setMode("resting");
        return;
      }
      const res = await sendVision(ctx.current, img, question);
      await applyReply(res);
    } catch (e: any) {
      showToast(e?.message ?? "Falha ao analisar a imagem");
      setMode("resting");
    } finally {
      setLiveBusy(false);
    }
  }, [applyReply, liveBusy, showToast]);

  // ---------------------------------------------------------------- clocks: conversation window, sleep, timer
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const m = modeRef.current;
      if (m === "conversation" && n > convUntil.current) setMode("resting");
      if (m === "resting" && n - lastActivity.current > SLEEP_AFTER_MS && !liveOpenRef.current) {
        setMode("sleeping");
        setExpression("sono");
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!timer || now < timer.end) return;
    const label = timer.label;
    setTimer(null);
    setTempExpression("animado", 5000);
    const fala = `Ei! O tempo do ${label} acabou!`;
    setCaption({ who: "orby", text: fala });
    if (settings.sound) {
      fetchTts(fala, settings.voice)
        .then(async (url) => {
          if (!url) return;
          await loop.pause();
          await playOrbyVoice(url, () => setMode("speaking"));
          setMode("resting");
          loop.resume();
        })
        .catch(() => {});
    }
  }, [now, timer, settings.sound, settings.voice, loop, setTempExpression]);

  // wake from sleep visuals when listening starts
  useEffect(() => {
    if (loop.phase === "capturing") lastActivity.current = Date.now();
  }, [loop.phase]);

  // ---------------------------------------------------------------- eyes: face tracking + micro-glances
  const onFace = useCallback((x: number, y: number, smiling: number, closeness: number) => {
    const n = Date.now();
    const away = n - lastFaceAt.current;
    lastFaceAt.current = n;
    gazeX.value = withSpring(x * 0.95, { damping: 16, stiffness: 140 });
    gazeY.value = withSpring(y * 0.8, { damping: 16, stiffness: 140 });
    if (away > 20000 && modeRef.current === "sleeping") {
      lastActivity.current = n;
      setMode("resting");
      setTempExpression("curioso", 2500);
    } else if (away > 20000 && modeRef.current === "resting") {
      setTempExpression("feliz", 2500);
    }
    if (smiling > 0.75 && n - lastSmileAt.current > 15000 && modeRef.current !== "speaking") {
      lastSmileAt.current = n;
      setTempExpression("feliz", 3000);
    }
    if (closeness > 0.6 && n - lastSmileAt.current > 15000) {
      lastSmileAt.current = n;
      setTempExpression("surpreso", 1500);
    }
  }, [gazeX, gazeY, setTempExpression]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => {
        if (Date.now() - lastFaceAt.current > 1500) {
          const m = modeRef.current;
          const hudOpen = !!hudRef.current;
          let x = 0;
          let y = 0;
          if (hudOpen) {
            x = -0.75 + Math.random() * 0.2;
            y = -0.1 + Math.random() * 0.3;
          } else if (m !== "sleeping" && Math.random() > 0.35) {
            x = (Math.random() * 2 - 1) * 0.6;
            y = (Math.random() * 2 - 1) * 0.35;
          }
          const fast = { damping: 14, stiffness: 180 };
          gazeX.value = withSpring(x, fast);
          gazeY.value = withSpring(y, fast);
        }
        tick();
      }, 1200 + Math.random() * 2600);
    };
    tick();
    return () => clearTimeout(t);
  }, [gazeX, gazeY]);

  // ---------------------------------------------------------------- layout: face slides right when the left HUD opens
  const eyeSize = Math.min((landscape ? height : width) * (landscape ? 0.36 : 0.27), 150);
  const faceW = eyeSize * 2.42 + eyeSize * 0.8;
  const hudWidth = hud?.mode === "resumo"
    ? Math.min(480, landscape ? width * 0.5 : width * 0.72)
    : Math.min(340, landscape ? width * 0.42 : width * 0.72);
  const hudRef = useRef(hud);
  hudRef.current = hud;

  useEffect(() => {
    if (hud) {
      const left = 16 + hudWidth;
      const free = width - left;
      shiftX.value = withSpring(left + free / 2 - width / 2, { damping: 16, stiffness: 110 });
      faceScale.value = withSpring(Math.max(0.36, Math.min(1, (free - 8) / faceW)), { damping: 16, stiffness: 110 });
      gazeX.value = withSpring(-0.75);
    } else {
      shiftX.value = withSpring(0, { damping: 16, stiffness: 110 });
      faceScale.value = withSpring(1, { damping: 16, stiffness: 110 });
    }
  }, [hud, hudWidth, width, faceW, shiftX, faceScale, gazeX]);

  useEffect(() => {
    if (hud?.mode !== "relogio") return;
    const t = setTimeout(() => setHud((h) => (h?.mode === "relogio" ? null : h)), 12000);
    return () => clearTimeout(t);
  }, [hud]);

  // ---------------------------------------------------------------- app lifecycle
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        loop.checkPermission();
        loop.resume();
      } else {
        stopAudio();
        loop.pause();
      }
    });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (modeRef.current === "speaking") {
        stopAudio();
        return true;
      }
      return false;
    });
    return () => {
      sub.remove();
      back.remove();
    };
  }, [loop]);

  // ---------------------------------------------------------------- derived UI
  const capturing = loop.phase === "capturing";
  const faceMode: FaceMode = useMemo(() => {
    if (mode === "speaking" || mode === "thinking" || mode === "sleeping") return mode;
    if (capturing) return "listening";
    return mode === "conversation" ? "conversation" : "resting";
  }, [mode, capturing]);

  const faceExpr = faceMode === "listening" && expression === "neutro" ? "ouvindo" : expression;

  const micOff = loop.permission !== "granted";
  const status = mode === "speaking" ? "FALANDO"
    : mode === "thinking" ? "PENSANDO..."
    : capturing ? "OUVINDO..."
    : micOff ? "MICROFONE DESLIGADO"
    : mode === "sleeping" ? "DORMINDO · DIGA “ORBY”"
    : mode === "conversation" ? "CONVERSANDO · PODE FALAR"
    : settings.alwaysListen && loop.continuousOk ? "DESCANSO · DIGA “ORBY”"
    : "TOQUE NO MICROFONE";

  const onMic = async () => {
    if (mode === "speaking") {
      stopAudio();
      return;
    }
    lastActivity.current = Date.now();
    if (mode === "sleeping") setMode("resting");
    const perm = await loop.toggleManual();
    if (perm === "blocked") showToast("Microfone bloqueado. Libere nos Ajustes.");
  };

  const toggleLive = () => {
    lastActivity.current = Date.now();
    if (mode === "sleeping") setMode("resting");
    setLiveOpen((v) => !v);
  };

  const testVoice = async () => {
    try {
      const url = await fetchTts("Oi! Eu sou o Orby, e essa é a minha voz.", settings.voice);
      if (url) {
        await loop.pause();
        await playOrbyVoice(url);
        loop.resume();
      }
    } catch {
      showToast("Não consegui gerar a voz agora.");
    }
  };

  const barBottom = insets.bottom + spacing.lg;
  const showMicCard = loaded && settings.alwaysListen && loop.permission !== "granted" && !hideMicCard;
  const showEyeCard = !showMicCard && loaded && faceTrackingAvailable && settings.tracking && !tracker.granted && !hideEyeCard;
  const timerLeft = timer ? Math.max(0, Math.ceil((timer.end - now) / 1000)) : 0;

  return (
    <View style={styles.root} testID="orby-screen">
      <View style={styles.faceLayer} pointerEvents="none">
        <RobotFace expression={faceExpr} mode={faceMode} gazeX={gazeX} gazeY={gazeY} size={eyeSize} shiftX={shiftX} scale={faceScale} />
      </View>

      <HudPanel
        hud={hud}
        width={hudWidth}
        top={insets.top + (landscape ? 56 : height * 0.2)}
        maxHeight={landscape ? height * 0.42 : height * 0.36}
        onClose={() => setHud(null)}
      />

      {/* top status */}
      <View style={[styles.top, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Pressable onPress={() => setHud(hud ? null : { mode: "relogio" })} style={styles.status} testID="status-chip">
          <View style={[styles.dot, { backgroundColor: micOff ? colors.error : capturing ? colors.success : colors.brand }]} />
          <Text style={styles.statusTxt} testID="status-text">{status}</Text>
        </Pressable>
        {timer && (
          <View style={styles.status} testID="timer-chip">
            <TimerIcon size={14} color={colors.brand} />
            <Text style={styles.statusTxt}>{`${Math.floor(timerLeft / 60)}:${String(timerLeft % 60).padStart(2, "0")}`}</Text>
            <Pressable onPress={() => setTimer(null)} hitSlop={10} testID="timer-cancel-button">
              <X size={12} color={colors.brand} />
            </Pressable>
          </View>
        )}
      </View>

      {/* camera corner: face tracker preview or Gemini Live */}
      <View style={[styles.corner, { top: insets.top + 52 }]} pointerEvents="box-none">
        {liveOpen ? (
          <LiveCamera ref={liveRef} busy={liveBusy} onClose={() => setLiveOpen(false)} onDescribe={() => describe()} onReady={() => describe()} />
        ) : (
          settings.tracking && (
            <FaceTracker active={!liveOpen && AppState.currentState === "active"} granted={tracker.granted} mirror={settings.mirror} preview={settings.preview} onFace={onFace} />
          )
        )}
      </View>

      {/* captions */}
      <View style={[styles.captionWrap, { bottom: barBottom + 84 }]} pointerEvents="none">
        <Animated.Text
          key={caption.text}
          entering={FadeInDown.duration(260)}
          style={[styles.caption, caption.who === "user" && styles.captionUser]}
          numberOfLines={3}
          testID="caption-text"
        >
          {caption.who === "user" ? `Você: ${caption.text}` : caption.text}
        </Animated.Text>
      </View>

      {showMicCard && (
        <Animated.View entering={FadeIn} style={[styles.card, { bottom: barBottom + 84 }]} testID="mic-permission-card">
          <Microphone size={22} color={colors.brand} weight="fill" />
          <Text style={styles.cardTxt}>Libere o microfone para o Orby ficar em modo descanso e acordar quando você disser “Orby”.</Text>
          {loop.permission === "blocked" ? (
            <Pressable style={styles.cardBtn} onPress={() => Linking.openSettings()} testID="mic-open-settings-button">
              <Text style={styles.cardBtnTxt}>Abrir Ajustes</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.cardBtn} onPress={loop.requestPermission} testID="mic-allow-button">
              <Text style={styles.cardBtnTxt}>Permitir</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setHideMicCard(true)} hitSlop={10} testID="mic-card-dismiss-button">
            <X size={16} color={colors.muted} />
          </Pressable>
        </Animated.View>
      )}

      {showEyeCard && (
        <Animated.View entering={FadeIn} style={[styles.card, { bottom: barBottom + 84 }]} testID="eye-permission-card">
          <Eye size={22} color={colors.brand} weight="fill" />
          <Text style={styles.cardTxt}>Deixe os olhos do Orby te acompanharem pela câmera frontal (tudo no aparelho).</Text>
          {tracker.canAsk ? (
            <Pressable style={styles.cardBtn} onPress={tracker.request} testID="eye-allow-button">
              <Text style={styles.cardBtnTxt}>Permitir</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.cardBtn} onPress={() => Linking.openSettings()} testID="eye-open-settings-button">
              <Text style={styles.cardBtnTxt}>Abrir Ajustes</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setHideEyeCard(true)} hitSlop={10} testID="eye-card-dismiss-button">
            <X size={16} color={colors.muted} />
          </Pressable>
        </Animated.View>
      )}

      {toast && (
        <Animated.View entering={FadeInDown} exiting={FadeOut} style={[styles.toast, { top: insets.top + 52 }]} testID="toast">
          <Text style={styles.toastTxt}>{toast}</Text>
        </Animated.View>
      )}

      <BottomBar
        bottom={barBottom}
        capturing={capturing}
        level={loop.level}
        liveOpen={liveOpen}
        sound={settings.sound}
        onMic={onMic}
        onLive={toggleLive}
        onSound={() => {
          if (settings.sound) stopAudio();
          updateSettings({ sound: !settings.sound });
        }}
        onType={() => setSheet("type")}
        onMenu={() => setSheet("settings")}
      />

      <SettingsSheet
        visible={sheet === "settings"}
        settings={settings}
        trackingAvailable={faceTrackingAvailable}
        continuousOk={loop.continuousOk}
        onChange={updateSettings}
        onClose={() => setSheet(null)}
        onHistory={() => setSheet("history")}
        onClearMemories={async () => {
          await clearMemories(session);
          showToast("Memórias apagadas.");
        }}
        onTestVoice={testVoice}
      />
      <HistorySheet visible={sheet === "history"} session={session} onClose={() => setSheet(null)} />
      <TypeSheet visible={sheet === "type"} onClose={() => setSheet(null)} onSend={sendTyped} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
  faceLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  top: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontFamily: fonts.displayBold, color: colors.brand, fontSize: 13, letterSpacing: 1.5 },
  corner: { position: "absolute", right: spacing.lg, alignItems: "flex-end" },
  captionWrap: { position: "absolute", left: spacing.xl, right: spacing.xl, alignItems: "center" },
  caption: {
    fontFamily: fonts.text,
    color: colors.hudText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    textShadowColor: "rgba(0, 240, 255, 0.35)",
    textShadowRadius: 8,
    maxWidth: 560,
  },
  captionUser: { color: colors.muted, fontSize: 14 },
  card: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
  },
  cardTxt: { flex: 1, fontFamily: fonts.text, color: colors.hudText, fontSize: 13, lineHeight: 18 },
  cardBtn: { height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brand, justifyContent: "center" },
  cardBtnTxt: { fontFamily: fonts.displayBold, color: colors.onBrand, fontSize: 14 },
  toast: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: "86%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInverse,
  },
  toastTxt: { fontFamily: fonts.text, color: colors.onSurfaceInverse, fontSize: 13, textAlign: "center" },
});
