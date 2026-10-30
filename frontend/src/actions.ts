import { Linking } from "react-native";
import type { Action } from "@/src/api";

const enc = encodeURIComponent;

function calDate(iso: string, addMin = 0) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setMinutes(d.getMinutes() + addMin);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

export function actionUrl(a: NonNullable<Action>): string | null {
  switch (a.tipo) {
    case "email":
      return `mailto:${a.para ?? ""}?subject=${enc(a.assunto ?? "")}&body=${enc(a.corpo ?? "")}`;
    case "agenda": {
      const start = a.inicio ? calDate(a.inicio) : null;
      const end = a.inicio ? calDate(a.inicio, Number(a.duracao_min) || 60) : null;
      const dates = start && end ? `&dates=${start}/${end}` : "";
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(a.titulo ?? "Evento")}${dates}&details=${enc(a.detalhes ?? "")}`;
    }
    case "ligar":
      return `tel:${String(a.numero ?? "").replace(/[^\d+]/g, "")}`;
    case "whatsapp":
      return `https://wa.me/${String(a.numero ?? "").replace(/\D/g, "")}?text=${enc(a.texto ?? "")}`;
    case "mapa":
      return `https://www.google.com/maps/search/?api=1&query=${enc(a.lugar ?? "")}`;
    case "web":
      return `https://www.google.com/search?q=${enc(a.consulta ?? "")}`;
    case "youtube":
      return `https://www.youtube.com/results?search_query=${enc(a.consulta ?? "")}`;
    default:
      return null;
  }
}

export async function openAction(a: NonNullable<Action>): Promise<boolean> {
  const url = actionUrl(a);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch (e) {
    console.warn("[action] open failed", a.tipo, e);
    return false;
  }
}

export const ACTION_LABEL: Record<string, string> = {
  email: "Abrir e-mail",
  agenda: "Criar na agenda",
  ligar: "Ligar",
  whatsapp: "Abrir WhatsApp",
  mapa: "Abrir mapa",
  web: "Pesquisar na web",
  youtube: "Abrir YouTube",
};
