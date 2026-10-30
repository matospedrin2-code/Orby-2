import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { BACKEND } from "@/src/api";

// One module-level player so only one Orby voice plays at a time.
let player: AudioPlayer | null = null;
let finish: (() => void) | null = null;

export function stopAudio() {
  try {
    player?.pause();
    player?.remove();
  } catch {}
  player = null;
  finish?.();
  finish = null;
}

export async function playOrbyVoice(path: string, onStart?: () => void): Promise<void> {
  stopAudio();
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  const url = path.startsWith("http") ? path : `${BACKEND}${path}`;
  const p = createAudioPlayer({ uri: url });
  player = p;
  return new Promise<void>((resolve) => {
    let started = false;
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      sub.remove();
      if (finish === end) finish = null;
      resolve();
    };
    finish = end;
    const watchdog = setTimeout(() => {
      console.warn("[audio] playback watchdog fired");
      stopAudio();
    }, 180000);
    const sub = p.addListener("playbackStatusUpdate", (s) => {
      if (s.playing && !started) {
        started = true;
        onStart?.();
      }
      if (s.didJustFinish) {
        try {
          p.remove();
        } catch {}
        if (player === p) player = null;
        end();
      }
    });
    p.play();
  });
}
