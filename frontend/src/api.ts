import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";
import { uploadForm } from "@/src/utils/upload";

export const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL as string;

export type HudData = { modo?: "relogio" | "fechar"; titulo?: string; texto?: string } | null;
export type Action = { tipo: string; [k: string]: any } | null;
export type OrbyReply = {
  fala: string;
  expressao: string;
  hud: HudData;
  acao: Action;
  audio_url: string | null;
  kind?: string;
};
export type VoiceTurn = Partial<OrbyReply> & { transcript: string; woke: boolean; reason?: string };

export type Settings = {
  name: string;
  voice: string;
  pause: "curta" | "media" | "longa";
  alwaysListen: boolean;
  tracking: boolean;
  mirror: boolean;
  preview: boolean;
  sound: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  voice: "verse",
  pause: "media",
  alwaysListen: true,
  tracking: true,
  mirror: false,
  preview: true,
  sound: true,
};

export const PAUSE_MS = { curta: 1500, media: 2500, longa: 4000 };

export async function loadSettings(): Promise<Settings> {
  const raw = await storage.getItem<string | null>("orby-settings", null);
  try {
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings) {
  await storage.setItem("orby-settings", JSON.stringify(s));
}

export async function getSessionId(): Promise<string> {
  let id = await storage.getItem<string | null>("orby-session", null);
  if (!id) {
    id = `orby-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.setItem("orby-session", id);
  }
  return id;
}

export function localTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Erro ${res.status}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

type Ctx = { session: string; settings: Settings; battery: number | null };

const base = (c: Ctx) => ({
  session_id: c.session,
  name: c.settings.name,
  client_time: localTime(),
  voice: c.settings.voice,
  speak: c.settings.sound,
  battery: c.battery,
});

export async function sendChat(c: Ctx, text: string): Promise<OrbyReply> {
  const res = await fetch(`${BACKEND}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...base(c), text }),
  });
  return json(res);
}

export async function sendVision(c: Ctx, image_base64: string, text: string): Promise<OrbyReply> {
  const res = await fetch(`${BACKEND}/api/vision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...base(c), text, image_base64 }),
  });
  return json(res);
}

export async function sendVoice(c: Ctx, uri: string, requireWake: boolean, image?: string | null): Promise<VoiceTurn> {
  const b = base(c);
  const isWeb = Platform.OS === "web";
  const res = await uploadForm(`${BACKEND}/api/voice-turn`, {
    files: { audio: { uri, name: isWeb ? "fala.webm" : "fala.m4a", mimeType: isWeb ? "audio/webm" : "audio/m4a" } },
    fields: {
      session_id: b.session_id,
      require_wake: requireWake ? "1" : "0",
      name: b.name,
      client_time: b.client_time,
      voice: b.voice,
      speak: b.speak ? "1" : "0",
      battery: b.battery == null ? "" : String(b.battery),
      image_base64: image ?? "",
    },
  });
  return json(res);
}

export async function fetchTts(text: string, voice: string): Promise<string | null> {
  const res = await fetch(`${BACKEND}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  const data = await json<{ audio_url: string | null }>(res);
  return data.audio_url;
}

export type HistoryItem = { id: string; role: "user" | "orby"; text: string; kind: string; created_at: string };

export async function fetchHistory(session: string): Promise<HistoryItem[]> {
  return json(await fetch(`${BACKEND}/api/history/${session}`));
}

export async function clearHistory(session: string) {
  return json(await fetch(`${BACKEND}/api/history/${session}`, { method: "DELETE" }));
}

export async function fetchMemories(session: string): Promise<{ id: string; fact: string }[]> {
  return json(await fetch(`${BACKEND}/api/memories/${session}`));
}

export async function clearMemories(session: string) {
  return json(await fetch(`${BACKEND}/api/memories/${session}`, { method: "DELETE" }));
}
