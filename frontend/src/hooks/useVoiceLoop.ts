import { File, Paths } from "expo-file-system";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// Small mono file: ~0.25 MB per minute, so even a very long talk fits the 25 MB transcription limit.
const REC_OPTS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

const MAX_UTTERANCE_MS = 60 * 60 * 1000; // up to one hour of talking
const RECYCLE_MS = 30000; // restart idle recordings to keep files small
const SENSITIVITY_DB = 12;

export type LoopPhase = "off" | "armed" | "capturing" | "processing";
export type MicPermission = "unknown" | "granted" | "denied" | "blocked";

type Opts = {
  enabled: boolean; // continuous rest-mode listening
  silenceMs: number;
  onUtterance: (uri: string, manual: boolean) => Promise<void>;
};

function keepCopy(uri: string): string {
  if (Platform.OS === "web") return uri;
  try {
    const src = new File(uri);
    const dst = new File(Paths.cache, `orby-${Date.now()}.m4a`);
    src.copy(dst);
    return dst.uri;
  } catch (e) {
    console.warn("[voice] copy failed", e);
    return uri;
  }
}

export function useVoiceLoop({ enabled, silenceMs, onUtterance }: Opts) {
  const recorder = useAudioRecorder(REC_OPTS);
  const state = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<LoopPhase>("off");
  const [level, setLevel] = useState(0);
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [continuousOk, setContinuousOk] = useState(true);
  const s = useRef({ phase: "off" as LoopPhase, armedAt: 0, floor: -50, samples: 0, speechStart: 0, lastVoice: 0, manual: false, busy: false, paused: false, autoOk: true });
  const opts = useRef(opts0());
  function opts0() {
    return { enabled, silenceMs, onUtterance };
  }
  opts.current = { enabled, silenceMs, onUtterance };

  const setP = useCallback((p: LoopPhase) => {
    s.current.phase = p;
    setPhase(p);
  }, []);

  const checkPermission = useCallback(async () => {
    try {
      const r = await getRecordingPermissionsAsync();
      const v: MicPermission = r.granted ? "granted" : r.canAskAgain === false && r.status === "denied" ? "blocked" : r.status === "denied" ? "denied" : "unknown";
      setPermission(v);
      return v;
    } catch {
      return "unknown" as MicPermission;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    const r = await requestRecordingPermissionsAsync();
    const v: MicPermission = r.granted ? "granted" : r.canAskAgain ? "denied" : "blocked";
    setPermission(v);
    return v;
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const safeStop = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {}
  }, [recorder]);

  const arm = useCallback(async (manual = false) => {
    const st = s.current;
    if (st.busy || st.phase === "armed" || st.phase === "capturing") return;
    st.busy = true;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Object.assign(st, { armedAt: Date.now(), samples: 0, speechStart: 0, lastVoice: 0, manual });
      if (manual) {
        st.speechStart = Date.now();
        st.lastVoice = Date.now();
        setP("capturing");
      } else setP("armed");
    } catch (e) {
      console.warn("[voice] arm failed", e);
      setP("off");
    } finally {
      st.busy = false;
    }
  }, [recorder, setP]);

  const recycle = useCallback(async () => {
    const st = s.current;
    if (st.busy) return;
    st.busy = true;
    await safeStop();
    st.busy = false;
    setP("off");
    if (opts.current.enabled && st.autoOk && !st.paused) arm();
  }, [arm, safeStop, setP]);

  const finalize = useCallback(async () => {
    const st = s.current;
    if (st.phase !== "capturing" || st.busy) return;
    st.busy = true;
    setP("processing");
    const manual = st.manual;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ? keepCopy(recorder.uri) : null;
    } catch (e) {
      console.warn("[voice] stop failed", e);
    }
    st.busy = false;
    setP("off");
    // re-arm right away so nothing said during processing is lost
    if (opts.current.enabled && st.autoOk && !st.paused) arm();
    if (uri) opts.current.onUtterance(uri, manual).catch((e) => console.warn("[voice] utterance failed", e));
  }, [recorder, arm, setP]);

  // Voice activity detection on the metering stream
  useEffect(() => {
    const st = s.current;
    if (st.phase !== "armed" && st.phase !== "capturing") return;
    const m = state.metering;
    const now = Date.now();
    const t = now - st.armedAt;
    if (m === undefined || m === null) {
      if (t > 1800 && st.phase === "armed" && st.autoOk) {
        st.autoOk = false;
        setContinuousOk(false);
        safeStop().then(() => setP("off"));
      }
      return;
    }
    setLevel(Math.max(0, Math.min(1, (m - st.floor) / 30)));
    if (t < 400) return;
    const threshold = st.floor + SENSITIVITY_DB;
    if (st.phase === "armed") {
      if (m > threshold && st.samples > 4) {
        st.speechStart = now;
        st.lastVoice = now;
        setP("capturing");
      } else {
        st.floor = st.samples === 0 ? m : st.samples < 6 ? (st.floor * st.samples + m) / (st.samples + 1) : st.floor * 0.97 + m * 0.03;
        st.floor = Math.max(-70, Math.min(-18, st.floor));
        st.samples++;
        if (t > RECYCLE_MS) recycle();
      }
    } else {
      if (m > threshold) st.lastVoice = now;
      const limit = st.manual ? Math.max(opts.current.silenceMs, 4000) : opts.current.silenceMs;
      if (now - st.lastVoice > limit) {
        if (!st.manual && st.lastVoice - st.speechStart < 250) recycle();
        else finalize();
      } else if (now - st.speechStart > MAX_UTTERANCE_MS) finalize();
    }
  }, [state.metering, state.durationMillis, finalize, recycle, safeStop, setP]);

  // Start / stop continuous listening
  useEffect(() => {
    const st = s.current;
    if (enabled && permission === "granted" && st.autoOk && !st.paused && st.phase === "off") arm();
    if (!enabled && st.phase === "armed") recycle();
  }, [enabled, permission, arm, recycle]);

  // Mic must be closed while Orby speaks (half duplex)
  const pause = useCallback(async () => {
    const st = s.current;
    st.paused = true;
    if (st.phase === "armed" || st.phase === "capturing") {
      await safeStop();
      setP("off");
    }
  }, [safeStop, setP]);

  const resume = useCallback(() => {
    s.current.paused = false;
    if (opts.current.enabled && s.current.autoOk && s.current.phase === "off") arm();
  }, [arm]);

  // Tap-to-talk: start a manual turn, or end it when tapped again
  const toggleManual = useCallback(async () => {
    let perm = permission;
    if (perm !== "granted") perm = await requestPermission();
    if (perm !== "granted") return perm;
    const st = s.current;
    st.paused = false;
    if (st.phase === "capturing") {
      if (!st.manual) st.manual = true;
      await finalize();
    } else if (st.phase === "armed") {
      st.manual = true;
      st.speechStart = Date.now();
      st.lastVoice = Date.now();
      setP("capturing");
    } else if (st.phase === "off") {
      await arm(true);
    }
    return perm;
  }, [permission, requestPermission, finalize, arm, setP]);

  useEffect(() => () => {
    try {
      if (recorder.isRecording) recorder.stop().catch(() => {});
    } catch {}
  }, [recorder]);

  return {
    phase,
    level,
    permission,
    continuousOk,
    isManual: s.current.manual,
    requestPermission,
    checkPermission,
    pause,
    resume,
    toggleManual,
  };
}
