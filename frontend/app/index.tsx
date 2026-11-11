import { Clock, Eye, GearSix, Microphone, Timer as TimerIcon, X } from "phosphor-react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
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
import { ControlsBar } from "@/src/components/ControlsBar";
import { FaceTracker, faceTrackingAvailable, useTrackerPermission } from "@/src/components/FaceTracker";
import { GallerySheet } from "@/src/components/GallerySheet";
import { HistorySheet } from "@/src/components/HistorySheet";
import { RightHud, type HudState } from "@/src/components/hud/RightHud";
import type { BrainStats } from "@/src/components/hud/BrainPanel";
import { LiveCamera, type LiveCameraHandle } from "@/src/components/LiveCamera";
import { OrbyFace, type FaceMode } from "@/src/components/OrbyFace";
import { useBatteryPct } from "@/src/hooks/useBattery";
import { fetchStats } from "@/src/api";
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
  const [sheet, setSheet] = useState<null | "settings" | "history" | "type" | "gallery">(null);
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
  const shiftY = useSharedValue(0);

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
    exprTimer.current = setTimeout(() => setExpression(modeRef.current === "sleeping" ? "dormindo" : "calmo"), ms);
  }, []);

  // Brain panel appears while Orby thinks (if nothing else is on the panel)
  const thinkingHud = useRef(false);
  const startThinking = useCallback(() => {
    setMode("thinking");
    setExpression("pensativo");
    if (!hudRef.current || hudRef.current.mode === "relogio") {
      thinkingHud.current = true;
      setHud({ mode: "cerebro" });
    }
  }, []);
  const endThinkingHud = useCallback(() => {
    if (thinkingHud.current) setHud((h) => (h?.mode === "cerebro" ? null : h));
    thinkingHud.current = false;
  }, []);

  // ---------------------------------------------------------------- reply pipeline
  const applyReply = useCallback(async (res: OrbyReply, userText?: string) => {
    if (busyReply.current) return;
    busyReply.current = true;
    lastActivity.current = Date.now();
    if (userText) setCaption({ who: "user", text: userText });
    setTempExpression(res.expressao || "neutro", 9000);

    const h = res.hud;
    const wasThinking = thinkingHud.current;
    thinkingHud.current = false;
    if (liveOpenRef.current) {
      if (wasThinking) setHud(null);
    } else if (h?.modo === "relogio") setHud({ mode: "relogio" });
    else if (h?.modo === "cerebro") setHud({ mode: "cerebro" });
    else if (h?.modo === "fechar") setHud(null);
    else if (h?.texto || h?.itens?.length) setHud({ mode: "resumo", titulo: h.titulo || "Resumo", texto: h.texto, itens: h.itens });
    else if (wasThinking) setHud(null);

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
    if (!requireWake) startThinking();
    try {
      const img = liveOpenRef.current ? await liveRef.current?.snapshot() : null;
      const res = await sendVoice(ctx.current, uri, requireWake, img);
      if (!res.woke) {
        if (!requireWake) {
          endThinkingHud();
          showToast(res.reason === "no_wake" ? "Não entendi, pode repetir?" : "Não ouvi direito, fala de novo?");
          setTempExpression("confuso", 2500);
          setMode(Date.now() < convUntil.current ? "conversation" : "resting");
        }
        return;
      }
      await applyReply(res as OrbyReply, res.transcript);
    } catch (e: any) {
      console.warn("[turn] failed", e);
      if (!requireWake) {
        endThinkingHud();
        showToast(e?.message ?? "Falha na conexão");
        setTempExpression("sem_graca", 3000);
        setMode("resting");
      }
    }
  }, [applyReply, setTempExpression, showToast, startThinking, endThinkingHud]);

  const loop = useVoiceLoop({
    enabled: loaded && settings.alwaysListen && !!session,
    silenceMs: PAUSE_MS[settings.pause],
    onUtterance: handleUtterance,
  });
  loopRef.current = loop;

  const sendTyped = useCallback(async (text: string) => {
    startThinking();
    setCaption({ who: "user", text });
    try {
      const res = await sendChat(ctx.current, text);
      await applyReply(res);
    } catch (e: any) {
      endThinkingHud();
      showToast(e?.message ?? "Falha na conexão");
      setTempExpression("sem_graca", 3000);
      setMode("resting");
    }
  }, [applyReply, setTempExpression, showToast, startThinking, endThinkingHud]);

  const describe = useCallback(async (question = "O que você está vendo agora?") => {
    if (liveBusy) return;
    setLiveBusy(true);
    setMode("thinking");
    setExpression("atento");
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

  // Idle life: small human-like micro expressions while resting
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => {
        const idle = Date.now() - lastActivity.current;
        if (modeRef.current === "resting" && !busyReply.current) {
          const pool = idle > 90000 ? ["sonolento", "entediado", "calmo"]
            : idle > 45000 ? ["entediado", "duvida", "calmo", "timido"]
            : ["contente", "duvida", "timido", "calmo", "alegre"];
          setTempExpression(pool[Math.floor(Math.random() * pool.length)], 2600);
        }
        tick();
      }, 18000 + Math.random() * 22000);
    };
    tick();
    return () => clearTimeout(t);
  }, [setTempExpression]);

  // Brain panel numbers: real counts + live jitter while thinking
  const [stats, setStats] = useState<BrainStats>({ neural: 92, internet: 87, database: 76, context: 84 });
  useEffect(() => {
    if (hud?.mode !== "cerebro" || !session) return;
    let alive = true;
    const t0 = Date.now();
    fetchStats(session)
      .then((s) => {
        if (!alive) return;
        const ping = Date.now() - t0;
        setStats({
          neural: Math.min(99, 70 + s.memories * 3),
          internet: Math.max(40, Math.min(99, 100 - ping / 25)),
          database: Math.min(99, 60 + (s.messages % 40)),
          context: 80,
        });
      })
      .catch(() => {});
    const j = setInterval(() => {
      if (modeRef.current !== "thinking") return;
      setStats((s) => ({ ...s, context: 70 + Math.random() * 29, neural: Math.min(99, s.neural + (Math.random() - 0.4)) }));
    }, 700);
    return () => {
      alive = false;
      clearInterval(j);
    };
  }, [hud?.mode, session]);

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
            x = 0.6 + Math.random() * 0.3;
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

  // ---------------------------------------------------------------- layout: face slides left when the HUD opens on the right
  const sideL = insets.left + spacing.lg;
  const sideR = insets.right + spacing.lg;
  const faceW = landscape ? Math.min(width * 0.44, height * 1.1) : width * 0.82;
  const panelOpen = !!hud || liveOpen;
  const hudWidth = landscape
    ? hud?.mode === "relogio" && !liveOpen ? Math.min(width * 0.36, 420) : Math.min(width * 0.46, 620)
    : width - sideL - sideR;
  const hudLeft = landscape ? width - sideR - hudWidth : sideL;
  const hudTop = landscape ? Math.max(insets.top + 20, height * (hud?.mode === "relogio" && !liveOpen ? 0.3 : 0.1)) : height * 0.44;
  const hudRef = useRef(hud);
  hudRef.current = hud;

  useEffect(() => {
    const spring = { damping: 16, stiffness: 110 };
    if (panelOpen && landscape) {
      shiftX.value = withSpring((hudLeft - sideL) / 2 + sideL - width / 2, spring);
      shiftY.value = withSpring(0, spring);
      gazeX.value = withSpring(0.7);
    } else if (panelOpen) {
      shiftX.value = withSpring(0, spring);
      shiftY.value = withSpring(-height * 0.22, spring);
    } else {
      shiftX.value = withSpring(0, spring);
      shiftY.value = withSpring(0, spring);
    }
  }, [panelOpen, landscape, hudLeft, sideL, width, height, shiftX, shiftY, gazeX]);

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

  const faceExpr = faceMode === "sleeping"
    ? (["sono", "dormindo", "sono_profundo", "sonolento"].includes(expression) ? expression : "dormindo")
    : capturing && mode === "conversation" && ["calmo", "neutro"].includes(expression) ? "atento" : expression;

  const micOff = loop.permission !== "granted";
  const status = mode === "speaking" ? "Falando"
    : mode === "thinking" ? "Pensando"
    : capturing ? "Ouvindo"
    : micOff ? "Mic desligado"
    : mode === "sleeping" ? "Dormindo"
    : mode === "conversation" ? "Conversando"
    : settings.alwaysListen && loop.continuousOk ? "Descanso"
    : "Toque p/ falar";

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
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <RadialGradient id="ambient" cx="50%" cy="45%" rx="55%" ry="60%">
            <Stop offset="0" stopColor={colors.ambient} stopOpacity={0.75} />
            <Stop offset="1" stopColor={colors.surface} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#ambient)" />
      </Svg>

      <View style={styles.faceLayer} pointerEvents="none">
        <OrbyFace expression={faceExpr} mode={faceMode} gazeX={gazeX} gazeY={gazeY} width={faceW} shiftX={shiftX} shiftY={shiftY} />
      </View>

      <RightHud
        hud={hud}
        width={hudWidth}
        left={hudLeft}
        top={hudTop}
        maxTextHeight={landscape ? height * 0.52 : height * 0.3}
        clockSize={landscape ? Math.min(height * 0.22, 96) : 72}
        stats={stats}
        onClose={() => setHud(null)}
        live={liveOpen ? (
          <LiveCamera ref={liveRef} busy={liveBusy} height={landscape ? height * 0.5 : height * 0.32} onClose={() => setLiveOpen(false)} onDescribe={() => describe()} onReady={() => describe()} />
        ) : undefined}
      />

      {/* top-left: timer chip | top-right: tracker preview + settings */}
      <View style={[styles.top, { top: insets.top + spacing.lg, left: sideL }]} pointerEvents="box-none">
        <Pressable onPress={() => setHud(hud ? null : { mode: "relogio" })} hitSlop={8} style={styles.clockBtn} testID="status-chip">
          <Clock size={24} color={colors.brand} weight="duotone" />
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
      <View style={[styles.corner, { top: insets.top + spacing.lg, right: sideR }]} pointerEvents="box-none">
        {settings.tracking && !liveOpen && (
          <FaceTracker active={AppState.currentState === "active"} granted={tracker.granted} mirror={settings.mirror} preview={settings.preview} onFace={onFace} />
        )}
        <Pressable onPress={() => setSheet("settings")} style={styles.gear} testID="settings-button">
          <GearSix size={30} color={colors.brand} weight="fill" />
        </Pressable>
      </View>

      {/* captions */}
      {!(landscape && panelOpen) && (
        <View style={[styles.captionWrap, { bottom: barBottom + (landscape ? 4 : 76), left: landscape ? width * 0.42 : spacing.xl, right: sideR + spacing.lg }]} pointerEvents="none">
          <Animated.Text
            key={caption.text}
            entering={FadeInDown.duration(260)}
            style={[styles.caption, caption.who === "user" && styles.captionUser]}
            numberOfLines={landscape ? 2 : 3}
            testID="caption-text"
          >
            {caption.who === "user" ? `Você: ${caption.text}` : caption.text}
          </Animated.Text>
        </View>
      )}

      {showMicCard && (
        <Animated.View entering={FadeIn} style={[styles.card, { bottom: barBottom + 72 }]} testID="mic-permission-card">
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
        <Animated.View entering={FadeIn} style={[styles.card, { bottom: barBottom + 72 }]} testID="eye-permission-card">
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

      <ControlsBar
        left={sideL}
        bottom={barBottom}
        status={status}
        active={capturing}
        level={loop.level}
        liveOpen={liveOpen}
        sound={settings.sound}
        onMic={onMic}
        onLive={toggleLive}
        onSound={() => {
          if (settings.sound) stopAudio();
          updateSettings({ sound: !settings.sound });
        }}
      />

      <SettingsSheet
        visible={sheet === "settings"}
        settings={settings}
        trackingAvailable={faceTrackingAvailable}
        continuousOk={loop.continuousOk}
        onChange={updateSettings}
        onClose={() => setSheet(null)}
        onHistory={() => setSheet("history")}
        onType={() => setSheet("type")}
        onGallery={() => setSheet("gallery")}
        onClearMemories={async () => {
          await clearMemories(session);
          showToast("Memórias apagadas.");
        }}
        onTestVoice={testVoice}
      />
      <HistorySheet visible={sheet === "history"} session={session} onClose={() => setSheet(null)} />
      <TypeSheet visible={sheet === "type"} onClose={() => setSheet(null)} onSend={sendTyped} />
      <GallerySheet
        visible={sheet === "gallery"}
        onClose={() => setSheet(null)}
        onPick={(k) => {
          setSheet(null);
          lastActivity.current = Date.now();
          if (modeRef.current === "sleeping") setMode("resting");
          setTempExpression(k, 4000);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
  faceLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
  gear: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brand,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  clockBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", opacity: 0.7 },
  top: { position: "absolute", flexDirection: "row", gap: spacing.sm, alignItems: "center" },
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
  corner: { position: "absolute", flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  captionWrap: { position: "absolute", alignItems: "center" },
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
    alignSelf: "center",
    width: "92%",
    maxWidth: 560,
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
