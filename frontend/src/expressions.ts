// Eye shape for each of Orby's expressions. All values are relative to the base eye size.
// w,h: size scale | r: corner radius ratio | lidL/lidR: top eyelid cover (0..1)
// botL/botR: bottom "cheek" cover, creates ^^ happy eyes | ang: inner eyelid tilt in degrees
// sL/sR: per-eye scale | dy: vertical offset | gx/gy: gaze bias
export type ExprConfig = {
  w: number; h: number; r: number; lidL: number; lidR: number; botL: number; botR: number;
  ang: number; sL: number; sR: number; dy: number; gx: number; gy: number;
};

const base: ExprConfig = { w: 1, h: 1, r: 0.28, lidL: 0, lidR: 0, botL: 0, botR: 0, ang: 0, sL: 1, sR: 1, dy: 0, gx: 0, gy: 0 };
const e = (c: Partial<ExprConfig>): ExprConfig => ({ ...base, ...c });

export const EXPRESSIONS = {
  neutro: e({}),
  feliz: e({ h: 0.95, r: 0.42, botL: 0.42, botR: 0.42 }),
  animado: e({ sL: 1.12, sR: 1.12, r: 0.45, botL: 0.32, botR: 0.32 }),
  surpreso: e({ w: 0.9, h: 1.15, r: 0.5, sL: 1.2, sR: 1.2 }),
  triste: e({ h: 0.9, lidL: 0.35, lidR: 0.35, ang: -18, dy: 0.08, gy: 0.25 }),
  bravo: e({ lidL: 0.42, lidR: 0.42, ang: 22 }),
  determinado: e({ h: 0.9, lidL: 0.3, lidR: 0.3, ang: 12 }),
  desconfiado: e({ lidL: 0.48, lidR: 0.2, gx: 0.3 }),
  sono: e({ h: 0.9, r: 0.5, lidL: 0.84, lidR: 0.84, dy: 0.06 }),
  amoroso: e({ sL: 1.06, sR: 1.06, r: 0.5, botL: 0.3, botR: 0.3 }),
  pensando: e({ lidL: 0.15, lidR: 0.3, sL: 0.92, gx: 0.55, gy: -0.6 }),
  vergonha: e({ sL: 0.85, sR: 0.85, botL: 0.4, botR: 0.4, lidL: 0.15, lidR: 0.15, dy: 0.1, gx: -0.3, gy: 0.5 }),
  brincalhao: e({ botL: 0.52, lidL: 0.2, sR: 1.08, r: 0.4 }),
  curioso: e({ sL: 1.15, sR: 0.9, lidR: 0.15, gy: -0.15 }),
  confuso: e({ sL: 0.85, sR: 1.1, lidL: 0.25, ang: 8 }),
  orgulhoso: e({ lidL: 0.3, lidR: 0.3, botL: 0.3, botR: 0.3, ang: -6, gy: -0.2 }),
  ouvindo: e({ sL: 1.08, sR: 1.08, r: 0.34 }),
} satisfies Record<string, ExprConfig>;

export type Expression = keyof typeof EXPRESSIONS;

export const EXPR_KEYS = ["w", "h", "r", "lidL", "lidR", "botL", "botR", "ang", "sL", "sR", "dy", "gx", "gy"] as const;

export function toArr(name: string): number[] {
  const c = (EXPRESSIONS as Record<string, ExprConfig>)[name] ?? EXPRESSIONS.neutro;
  return EXPR_KEYS.map((k) => c[k]);
}
