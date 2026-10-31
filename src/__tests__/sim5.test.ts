import { describe, expect, it } from 'vitest';
import { analyze } from '../core/engine/analyze';
import { mulberry32 } from '../core/engine/generate';
import { reduceNetwork } from '../core/engine/methods/reduce';
import { dcEjemplo, dcEnergy, parallelC, parallelInductors, parallelL, redInductores, seriesC, seriesCapacitors, seriesInductorsDivision, seriesL, waveAnalysis } from '../sim/calc';
import { GENS } from '../sim/content';

describe('Simulador 5 — relaciones v–i', () => {
  it('inductor con corriente trapezoidal: v = L·pendiente', () => {
    const r = waveAnalysis('L', 'i', [{ from: 0, to: 0.002, expr: '5000*t' }, { from: 0.002, to: 0.004, expr: '10' }], 0.01, 0, 0.001);
    expect(r.ok).toBe(true);
    expect(r.at.y).toBeCloseTo(50, 9);
    expect(r.at.w).toBeCloseTo(0.5 * 0.01 * 25, 12);
    // el último tramo termina en 10 A y fuera de los tramos se toma 0: hay un salto en t = 4 ms
    expect(r.jumps.map((j) => j.t)).toEqual([0.004]);
  });
  it('capacitor: i = C dv/dt de una exponencial', () => {
    const r = waveAnalysis('C', 'v', [{ from: 0, to: Infinity, expr: '10*(1-exp(-t/0.001))' }], 100e-6, 0, 0.001);
    expect(r.at.y).toBeCloseTo(100e-6 * 10 * Math.exp(-1) / 0.001, 9);
  });
  it('capacitor: v(t) = v(0) + (1/C)∫i dt', () => {
    const r = waveAnalysis('C', 'i', [{ from: 0, to: 0.002, expr: '0.5' }, { from: 0.002, to: 0.004, expr: '-0.25' }], 100e-6, 2, 0.003);
    expect(r.at.y).toBeCloseTo(2 + (0.5 * 0.002 - 0.25 * 0.001) / 100e-6, 6);
  });
  it('detecta salto de corriente en el inductor (impulso)', () => {
    const r = waveAnalysis('L', 'i', [{ from: -Infinity, to: 0, expr: '0' }, { from: 0, to: Infinity, expr: '5' }], 0.01, 0, 1);
    expect(r.jumps.length).toBe(1);
  });
  it('rechaza L o C no positivas', () => {
    expect(waveAnalysis('L', 'i', [{ from: 0, to: 1, expr: 't' }], 0, 0, 0.5).ok).toBe(false);
  });
});

describe('Simulador 5 — combinaciones y DC', () => {
  it('fórmulas de serie y paralelo', () => {
    expect(seriesL([1, 2])).toBe(3);
    expect(parallelL([2, 2])).toBeCloseTo(1, 12);
    expect(seriesC([20e-6, 20e-6])).toBeCloseTo(10e-6, 15);
    expect(parallelC([10e-6, 5e-6])).toBeCloseTo(15e-6, 15);
  });
  it('capacitores en serie: misma carga y voltajes inversos a C', () => {
    const r = seriesCapacitors([200e-6, 50e-6], [0, 0], 100);
    expect(r.Q[0]).toBeCloseTo(r.Q[1], 12);
    expect(r.Vk[0]).toBeCloseTo(20, 9);
    expect(r.Vk[1]).toBeCloseTo(80, 9);
  });
  it('inductores en paralelo con corrientes iniciales y en serie', () => {
    expect(parallelInductors([0.5, 1.5], [1, -0.5]).i0eq).toBeCloseTo(0.5, 12);
    expect(seriesInductorsDivision([1, 3], 12).Vk).toEqual([3, 9]);
  });
  it('red de inductores del material se reduce', () => {
    const a = analyze(redInductores());
    const ia = a.net.nodeNames.indexOf('a');
    const ib = a.net.nodeNames.indexOf('b');
    const edges = a.net.elements.map((e) => ({ id: e.id, name: e.label, R: e.value, a: e.n1, b: e.n2, from: [e.id] }));
    const red = reduceNetwork(edges, ia, ib);
    expect(red.ok).toBe(true);
    expect(red.Req).toBeCloseTo(0.56 + parallelL([1.2, 1.2, 1.8]), 12);
  });
  it('DC: L corto, C abierto y energía', () => {
    const a = analyze(dcEjemplo());
    expect(a.ok).toBe(true);
    const en = dcEnergy(a);
    const L = en.find((x) => x.kind === 'L')!;
    const C = en.find((x) => x.kind === 'C')!;
    expect(L.x).toBeCloseTo(2, 9); // 12/(2+4)
    expect(C.x).toBeCloseTo(8, 9); // 2 A · 4 Ω
    expect(L.W).toBeCloseTo(0.5 * 0.5 * 4, 9);
    expect(C.W).toBeCloseTo(0.5 * 100e-6 * 64, 12);
  });
  it('ejercicios generados con respuestas finitas', () => {
    const r = mulberry32(9);
    for (const g of GENS)
      for (const l of ['basico', 'intermedio', 'examen'] as const) {
        let ex = g.gen(r, l);
        for (let k = 0; k < 30 && !ex.answers.every((a) => isFinite(a.value)); k++) ex = g.gen(r, l);
        for (const x of ex.answers) expect(isFinite(x.value)).toBe(true);
      }
  });
});
