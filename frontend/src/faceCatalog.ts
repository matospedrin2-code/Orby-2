// Orby's expression catalogue (56 faces), modelled on the reference sheet.
// Each face = left eye + right eye + eyebrows + mouth + extras (blush, tears, zzz...).
export type EyeKind =
  | "open" | "big" | "small" | "round" | "flat" | "tired" | "angry" | "sad" | "squint" | "relaxed"
  | "smileClosed" | "arc" | "chevron" | "star" | "heart" | "closed" | "wink" | "dot" | "ring"
  | "sparkle" | "spiral" | "side";
export type BrowKind = "none" | "raised" | "flat" | "angry" | "sad" | "worried" | "skeptic";
export type MouthKind =
  | "none" | "line" | "smallSmile" | "smile" | "bigSmile" | "openD" | "wideD" | "o" | "O" | "oval"
  | "frown" | "smallFrown" | "wavy" | "zigzag" | "cat" | "tongue" | "teeth" | "kiss" | "heart"
  | "smirk" | "triangle" | "drool";
export type Extra = "blush" | "sweat" | "tears" | "stream" | "zzz" | "question" | "anger" | "sparkle" | "hearts";

export type FaceDef = { key: string; eyeL: EyeKind; eyeR: EyeKind; brow: BrowKind; mouth: MouthKind; extras: Extra[] };

type Row = [EyeKind, EyeKind, BrowKind, MouthKind, Extra[]];

const C: Record<string, Row> = {
  neutro: ["open", "open", "none", "line", []],
  calmo: ["open", "open", "none", "bigSmile", []],
  feliz: ["smileClosed", "smileClosed", "none", "openD", []],
  muito_feliz: ["arc", "arc", "none", "openD", ["blush"]],
  fofo: ["arc", "arc", "none", "cat", ["blush"]],
  alegre: ["open", "open", "none", "openD", ["blush"]],
  contente: ["open", "open", "none", "smile", ["blush"]],
  radiante: ["chevron", "chevron", "none", "openD", ["blush"]],
  maravilhado: ["star", "star", "none", "openD", ["blush"]],
  sereno: ["relaxed", "relaxed", "none", "openD", ["blush"]],
  apaixonado: ["heart", "heart", "none", "openD", ["blush"]],
  animado: ["big", "big", "none", "wideD", []],
  piscadinha: ["open", "wink", "none", "smile", ["blush"]],
  brincalhao: ["open", "open", "none", "tongue", []],
  chocado: ["ring", "ring", "raised", "O", []],
  surpreso: ["dot", "dot", "raised", "o", []],
  nervoso: ["dot", "dot", "raised", "O", ["sweat"]],
  assustado: ["dot", "dot", "raised", "triangle", []],
  apavorado: ["dot", "big", "raised", "wavy", ["sweat"]],
  preocupado: ["sad", "sad", "worried", "wavy", []],
  desconfiado: ["side", "side", "flat", "smallFrown", []],
  bravo: ["angry", "angry", "angry", "teeth", []],
  irritado: ["angry", "angry", "angry", "smallFrown", ["sweat"]],
  furioso: ["angry", "angry", "angry", "zigzag", ["anger"]],
  emburrado: ["flat", "flat", "flat", "cat", []],
  determinado: ["squint", "squint", "angry", "line", []],
  rabugento: ["angry", "angry", "angry", "frown", []],
  cansado: ["tired", "tired", "flat", "frown", []],
  triste: ["sad", "sad", "sad", "frown", []],
  chorando: ["sad", "sad", "sad", "wavy", ["stream"]],
  melancolico: ["sad", "sad", "sad", "smallFrown", []],
  choroso: ["sad", "sad", "sad", "frown", ["tears"]],
  comovido: ["sparkle", "sparkle", "sad", "frown", ["tears"]],
  sonolento: ["closed", "closed", "none", "o", ["zzz"]],
  dormindo: ["closed", "closed", "none", "line", ["zzz"]],
  sono_profundo: ["closed", "closed", "none", "drool", ["zzz"]],
  timido: ["open", "open", "none", "smallSmile", ["blush"]],
  encantado: ["open", "open", "none", "openD", ["blush", "hearts"]],
  beijinho: ["open", "open", "none", "kiss", ["blush"]],
  envergonhado: ["open", "open", "none", "o", ["blush", "sweat"]],
  amoroso: ["open", "open", "none", "cat", ["blush", "hearts"]],
  sem_graca: ["open", "open", "none", "wavy", ["blush"]],
  confuso: ["round", "small", "none", "smallFrown", []],
  pensativo: ["open", "open", "none", "smallFrown", ["question"]],
  cetico: ["flat", "open", "skeptic", "smirk", []],
  duvida: ["open", "small", "raised", "line", ["question"]],
  tonto: ["spiral", "spiral", "none", "wavy", []],
  entediado: ["tired", "tired", "flat", "wavy", []],
  confiante: ["open", "wink", "none", "smile", ["sparkle"]],
  marotinho: ["open", "wink", "none", "smirk", ["blush"]],
  descolado: ["flat", "flat", "none", "smirk", []],
  zoeiro: ["flat", "flat", "none", "tongue", ["sparkle"]],
  serio: ["open", "open", "none", "smallFrown", []],
  ansioso: ["dot", "dot", "worried", "wavy", ["blush"]],
  coracao: ["open", "open", "none", "heart", ["blush"]],
  atento: ["big", "big", "raised", "line", []],
};

const ALIASES: Record<string, string> = {
  pensando: "pensativo",
  sono: "dormindo",
  curioso: "duvida",
  orgulhoso: "confiante",
  vergonha: "envergonhado",
  ouvindo: "atento",
};

export const FACE_KEYS = Object.keys(C);

export function getFace(key: string): FaceDef {
  const k = C[key] ? key : C[ALIASES[key]] ? ALIASES[key] : "calmo";
  const [eyeL, eyeR, brow, mouth, extras] = C[k];
  return { key: k, eyeL, eyeR, brow, mouth, extras };
}

// Eye kinds that can blink naturally
export const BLINKABLE = new Set<EyeKind>(["open", "big", "small", "round", "flat", "tired", "angry", "sad", "squint", "dot", "ring", "sparkle", "side", "star", "heart", "relaxed", "chevron", "spiral"]);

// Positive faces talk with an open "D" mouth, negative ones with an oval
export const NEGATIVE_MOUTHS = new Set<MouthKind>(["frown", "smallFrown", "wavy", "zigzag", "teeth", "triangle"]);
