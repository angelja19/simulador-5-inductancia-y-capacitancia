// Cálculos del Simulador 5: relaciones v–i de L y C, continuidad, combinaciones y energía en DC.
import { compilePieces, CompiledPiece, evalDeriv, evalPW, integratePW, Piece } from '../core/engine/expr';
import { Analysis } from '../core/engine/analyze';
import { cb } from '../core/engine/builder';
import { Circuit } from '../core/engine/types';

export type Elem = 'L' | 'C';

export interface WaveResult {
  ok: boolean;
  error?: string;
  pw: CompiledPiece[];
  ts: number[];
  x: number[]; // variable dada
  y: number[]; // variable calculada
  p: number[];
  w: number[];
  /** saltos de la variable de estado (iL o vC) en las fronteras */
  jumps: { t: number; before: number; after: number }[];
  range: [number, number];
  at: { x: number; y: number; p: number; w: number };
}

/**
 * L: dato i(t) → v = L di/dt ; dato v(t) → i = i(t0) + (1/L)∫v
 * C: dato v(t) → i = C dv/dt ; dato i(t) → v = v(t0) + (1/C)∫i
 */
export function waveAnalysis(elem: Elem, given: 'i' | 'v', pieces: Piece[], K: number, x0: number, tEval: number): WaveResult {
  const empty = { ok: false, pw: [], ts: [], x: [], y: [], p: [], w: [], jumps: [], range: [0, 1] as [number, number], at: { x: 0, y: 0, p: 0, w: 0 } };
  if (!(K > 0)) return { ...empty, error: `${elem === 'L' ? 'La inductancia' : 'La capacitancia'} debe ser mayor que cero.` };
  const c = compilePieces(pieces);
  if (!c.ok) return { ...empty, error: c.error };
  const pw = c.pieces;
  const fin = pw.flatMap((p) => [p.from, p.to]).filter(isFinite);
  let a = fin.length ? Math.min(...fin) : 0;
  let b = fin.length ? Math.max(...fin) : 1;
  if (a === b) b = a + 1;
  if (pw.some((p) => p.from === -Infinity)) a -= (b - a) * 0.2;
  if (pw.some((p) => p.to === Infinity)) b += (b - a) * 0.2;
  const N = 600;
  const ts = Array.from({ length: N + 1 }, (_, k) => a + ((b - a) * k) / N);
  const f = (t: number) => evalPW(pw, t);
  // estado = iL (L) o vC (C)
  const derivative = (elem === 'L' && given === 'i') || (elem === 'C' && given === 'v');
  let ys: number[];
  let stateAt: (t: number) => number;
  const jumps: WaveResult['jumps'] = [];
  if (derivative) {
    ys = ts.map((t) => K * evalDeriv(pw, t));
    stateAt = f;
    for (let k = 1; k < pw.length; k++) {
      const t = pw[k].from;
      if (pw[k - 1].to !== t) continue;
      const before = Number(pw[k - 1].f.evaluate({ t }));
      const after = Number(pw[k].f.evaluate({ t }));
      if (Math.abs(before - after) > 1e-9 * Math.max(1, Math.abs(before), Math.abs(after))) jumps.push({ t, before, after });
    }
    // fuera de los tramos la variable vale 0: también hay salto si el primer tramo no empieza en 0 o el último no termina en 0
    const first = pw[0];
    const last = pw[pw.length - 1];
    if (isFinite(first.from)) {
      const v0 = Number(first.f.evaluate({ t: first.from }));
      if (Math.abs(v0) > 1e-9 * Math.max(1, Math.abs(v0))) jumps.push({ t: first.from, before: 0, after: v0 });
    }
    if (isFinite(last.to)) {
      const v1 = Number(last.f.evaluate({ t: last.to }));
      if (Math.abs(v1) > 1e-9 * Math.max(1, Math.abs(v1))) jumps.push({ t: last.to, before: v1, after: 0 });
    }
  } else {
    const t0 = isFinite(pw[0].from) ? pw[0].from : a;
    const integ = (t: number) => (t <= t0 ? x0 : x0 + integratePW(f, pw, t0, t) / K);
    ys = [];
    let acc = x0;
    ys.push(ts[0] <= t0 ? x0 : integ(ts[0]));
    for (let k = 1; k < ts.length; k++) {
      if (ts[k] <= t0) {
        ys.push(x0);
        continue;
      }
      acc = (ys[k - 1] ?? x0) + integratePW(f, pw, Math.max(ts[k - 1], t0), ts[k]) / K;
      ys.push(acc);
    }
    stateAt = integ;
  }
  const xs = ts.map(f);
  const i = (k: number) => (given === 'i' ? xs[k] : ys[k]);
  const v = (k: number) => (given === 'v' ? xs[k] : ys[k]);
  const p = ts.map((_, k) => v(k) * i(k));
  const w = ts.map((t, k) => 0.5 * K * (derivative ? xs[k] : ys[k]) ** 2);
  // valores en t*
  const xE = f(tEval);
  const yE = derivative ? K * evalDeriv(pw, tEval) : stateAt(tEval);
  const st = derivative ? xE : yE;
  const iE = given === 'i' ? xE : yE;
  const vE = given === 'v' ? xE : yE;
  return { ok: true, pw, ts, x: xs, y: ys, p, w, jumps, range: [a, b], at: { x: xE, y: yE, p: iE * vE, w: 0.5 * K * st * st } };
}

// ---------------- combinaciones ----------------
export function seriesL(L: number[]) {
  return L.reduce((a, b) => a + b, 0);
}
export function parallelL(L: number[]) {
  return 1 / L.reduce((a, b) => a + 1 / b, 0);
}
export function seriesC(C: number[]) {
  return 1 / C.reduce((a, b) => a + 1 / b, 0);
}
export function parallelC(C: number[]) {
  return C.reduce((a, b) => a + b, 0);
}

/** Capacitores en serie con tensiones iniciales, conectados a V: carga común y voltajes */
export function seriesCapacitors(C: number[], v0: number[], V: number) {
  const Ceq = seriesC(C);
  const V0eq = v0.reduce((a, b) => a + b, 0);
  // la carga que entra (común a todos) es ΔQ = Ceq (V − ΣV0)
  const dQ = Ceq * (V - V0eq);
  const Vk = C.map((c, k) => v0[k] + dQ / c);
  const Q = C.map((c, k) => c * Vk[k]);
  return { Ceq, V0eq, dQ, Vk, Q, W: C.map((c, k) => 0.5 * c * Vk[k] ** 2) };
}
/** Inductores en paralelo con corrientes iniciales: i_eq(0) = Σ i_k(0) */
export function parallelInductors(L: number[], i0: number[]) {
  const Leq = parallelL(L);
  return { Leq, i0eq: i0.reduce((a, b) => a + b, 0) };
}
/** Inductores en serie: misma corriente, voltaje dividido en proporción a L */
export function seriesInductorsDivision(L: number[], V: number) {
  const Leq = seriesL(L);
  return { Leq, Vk: L.map((l) => (l / Leq) * V) };
}

// ---------------- energía en DC ----------------
export function dcEnergy(a: Analysis) {
  if (!a.dc) return [];
  return a.net.elements
    .filter((e) => e.kind === 'L' || e.kind === 'C')
    .map((e) => {
      const r = a.dc!.el.get(e.id)!;
      return e.kind === 'L' ? { id: e.id, label: e.label, kind: 'L' as const, value: e.value, x: r.i, W: 0.5 * e.value * r.i * r.i } : { id: e.id, label: e.label, kind: 'C' as const, value: e.value, x: r.v, W: 0.5 * e.value * r.v * r.v };
    });
}

export function dcEjemplo(): Circuit {
  const b = cb();
  b.el('V', 'E', '12', [0, 0], [0, 8]);
  b.el('R', 'R1', '2', [0, 0], [8, 0]);
  b.el('L', 'L1', '0,5', [8, 0], [16, 0]);
  b.el('R', 'R2', '4', [16, 0], [16, 8]);
  b.el('C', 'C1', '100µ', [8, 0], [8, 8]);
  b.wire([0, 8], [16, 8]);
  b.gnd([0, 8]);
  return b.build();
}
/** Red de inductores para reducir (estilo del material: L2 ∥ L3, luego ∥ L4 y en serie con L1) */
export function redInductores(): Circuit {
  const b = cb();
  b.el('L', 'L1', '0,56', [0, 0], [8, 0]);
  b.el('L', 'L2', '1,2', [8, 0], [8, 8]);
  b.wire([8, 0], [16, 0]);
  b.el('L', 'L3', '1,2', [16, 0], [16, 8]);
  b.wire([16, 0], [24, 0]);
  b.el('L', 'L4', '1,8', [24, 0], [24, 8]);
  b.wire([0, 8], [24, 8]);
  b.name([0, 0], 'a');
  b.name([0, 8], 'b');
  return b.build();
}
export function redCapacitores(): Circuit {
  const b = cb();
  b.el('C', 'C1', '200µ', [0, 0], [8, 0]);
  b.el('C', 'C2', '50µ', [8, 0], [8, 8]);
  b.wire([8, 0], [16, 0]);
  b.el('C', 'C3', '40µ', [16, 0], [16, 8]);
  b.wire([0, 8], [16, 8]);
  b.name([0, 0], 'a');
  b.name([0, 8], 'b');
  return b.build();
}
