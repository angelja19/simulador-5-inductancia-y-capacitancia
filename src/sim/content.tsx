import React from 'react';
import { pick } from '../core/engine/generate';
import { texNum, texQ } from '../core/engine/units';
import { Tex } from '../core/ui/basic';
import { CircuitPreview } from '../core/ui/CircuitPreview';
import { ExerciseGen, LearnSection } from '../core/ui/Practice';
import { BOX, P, T } from '../core/ui/panels';
import { dcEjemplo, parallelC, parallelL, redCapacitores, redInductores, seriesC, seriesL } from './calc';

export const LEARN: LearnSection[] = [
  {
    title: '5.1 El inductor',
    body: (
      <>
        <p>Bobina de alambre que almacena energía en su campo magnético. Se opone a los <b>cambios</b> de corriente.</p>
        <Tex block tex="v = L\frac{di}{dt},\qquad i(t) = \frac{1}{L}\int_{t_0}^{t} v\,d\tau + i(t_0),\qquad w = \tfrac12 L i^2" />
        <p>Unidad: henrio [H]. Un cambio instantáneo de corriente exigiría voltaje infinito: <b>la corriente del inductor es continua</b>. En DC es un <b>cortocircuito</b>.</p>
      </>
    ),
  },
  {
    title: '5.2 El capacitor',
    body: (
      <>
        <p>Dos placas separadas por un dieléctrico; almacena energía en su campo eléctrico. <Tex tex="q = Cv" />.</p>
        <Tex block tex="i = C\frac{dv}{dt},\qquad v(t) = \frac{1}{C}\int_{t_0}^{t} i\,d\tau + v(t_0),\qquad w = \tfrac12 C v^2 = \frac{Q^2}{2C}" />
        <p>Unidad: faradio [F] (se usan µF, nF, pF). <b>El voltaje del capacitor es continuo</b>. En DC es un <b>circuito abierto</b>.</p>
      </>
    ),
  },
  {
    title: '5.3 Formas de onda y continuidad',
    body: <p>Si le dan i(t) de un inductor, v es L·(pendiente); si le dan v(t), i es el área acumulada dividida por L. Para el capacitor, lo mismo intercambiando v e i. Un salto en i_L o en v_C es físicamente imposible: requeriría un impulso.</p>,
  },
  {
    title: '5.4 Combinaciones',
    body: (
      <>
        <p><b>Inductores:</b> como resistencias. <Tex tex="L_s = \sum L_k" />, <Tex tex="1/L_p = \sum 1/L_k" />.</p>
        <p><b>Capacitores:</b> al revés. <Tex tex="C_p = \sum C_k" />, <Tex tex="1/C_s = \sum 1/C_k" />.</p>
        <div className="grid2">
          <CircuitPreview circuit={redInductores()} height={160} />
          <CircuitPreview circuit={redCapacitores()} height={160} />
        </div>
      </>
    ),
  },
  {
    title: '5.5 Comportamiento en DC',
    body: (
      <>
        <p>En régimen permanente: L = corto, C = abierto. Se resuelve el circuito resistivo y luego <Tex tex="W_L = \tfrac12 L I^2" />, <Tex tex="W_C = \tfrac12 C V^2" />.</p>
        <CircuitPreview circuit={dcEjemplo()} height={180} />
      </>
    ),
  },
];

export const GLOSSARY = [
  { term: 'Henrio (H)', def: 'Unidad de inductancia: 1 H produce 1 V cuando la corriente cambia 1 A/s.' },
  { term: 'Faradio (F)', def: 'Unidad de capacitancia: 1 F almacena 1 C por cada voltio.' },
  { term: 'Dieléctrico', def: 'Aislante entre las placas del capacitor.' },
  { term: 'Continuidad', def: 'i_L y v_C no pueden cambiar de golpe (no hay energía infinita disponible).' },
  { term: 'Impulso', def: 'Señal infinitamente alta y breve; no existe físicamente.' },
];

export const GENS: ExerciseGen[] = [
  {
    id: 'Voltaje en un inductor (rampa)',
    subtopic: '5.1 Inductor',
    gen: (r) => {
      const L = pick(r, [0.01, 0.02, 0.05, 0.1, 0.5]);
      const di = pick(r, [2, 4, 5, 10]);
      const dt = pick(r, [0.001, 0.002, 0.005, 0.01]);
      return { prompt: `La corriente de un inductor de $${texNum(L)}$ H sube linealmente $${di}$ A en $${texNum(dt)}$ s. ¿Qué voltaje tiene?`, answers: [{ label: 'v', value: (L * di) / dt, unit: 'V' }], hints: ['$v = L\\,\\Delta i/\\Delta t$'], solution: [T(`v = ${texNum(L)}\\cdot\\frac{${di}}{${texNum(dt)}} = ${texQ((L * di) / dt, 'V')}`)] };
    },
  },
  {
    id: 'Corriente en un capacitor (rampa)',
    subtopic: '5.2 Capacitor',
    gen: (r) => {
      const C = pick(r, [10e-6, 47e-6, 100e-6, 220e-6]);
      const dv = pick(r, [5, 10, 12, 24]);
      const dt = pick(r, [0.001, 0.002, 0.01]);
      return { prompt: `El voltaje de un capacitor de $${texNum(C * 1e6)}$ µF sube linealmente $${dv}$ V en $${texNum(dt)}$ s. ¿Qué corriente circula?`, answers: [{ label: 'i', value: (C * dv) / dt, unit: 'A' }], hints: ['$i = C\\,\\Delta v/\\Delta t$'], solution: [T(`i = ${texQ((C * dv) / dt, 'A')}`)] };
    },
  },
  {
    id: 'Energía almacenada',
    subtopic: '5.1–5.2 Energía',
    gen: (r) => {
      const isL = r() < 0.5;
      const K = isL ? pick(r, [0.1, 0.5, 1, 2]) : pick(r, [100e-6, 470e-6, 1e-3]);
      const x = isL ? pick(r, [1, 2, 3, 5]) : pick(r, [10, 12, 50, 100]);
      const W = 0.5 * K * x * x;
      return { prompt: isL ? `Un inductor de ${K} H lleva ${x} A. ¿Cuánta energía almacena?` : `Un capacitor de ${texNum(K * 1e6)} µF está a ${x} V. ¿Cuánta energía almacena?`, answers: [{ label: 'W', value: W, unit: 'J' }], hints: [isL ? '$W = \\tfrac12 L i^2$' : '$W = \\tfrac12 C v^2$'], solution: [T(`W = ${texQ(W, 'J')}`)] };
    },
  },
  {
    id: 'Capacitores en serie y paralelo',
    subtopic: '5.4 Combinaciones',
    gen: (r) => {
      const C = [pick(r, [10, 20, 30, 60]), pick(r, [15, 30, 40, 60])].map((x) => x * 1e-6);
      return { prompt: `Dos capacitores de ${C.map((c) => texNum(c * 1e6)).join(' µF y ')} µF. Halle C_eq en serie y en paralelo (en µF).`, answers: [{ label: 'C_s\\ [µF]', value: seriesC(C) * 1e6, unit: 'µF' }, { label: 'C_p\\ [µF]', value: parallelC(C) * 1e6, unit: 'µF' }], hints: ['Serie: producto sobre suma.', 'Paralelo: suma.'], solution: [T(`C_s = ${texNum(seriesC(C) * 1e6)}\\ \\mu F,\\ C_p = ${texNum(parallelC(C) * 1e6)}\\ \\mu F`)] };
    },
  },
  {
    id: 'Inductores en serie y paralelo',
    subtopic: '5.4 Combinaciones',
    gen: (r) => {
      const L = [pick(r, [0.2, 0.5, 1, 1.2]), pick(r, [0.3, 0.6, 1.8, 2])];
      return { prompt: `Dos inductores de ${L[0]} H y ${L[1]} H. Halle L_eq en serie y en paralelo.`, answers: [{ label: 'L_s', value: seriesL(L), unit: 'H' }, { label: 'L_p', value: parallelL(L), unit: 'H' }], hints: ['Como resistencias.'], solution: [T(`L_s = ${texNum(seriesL(L))},\\ L_p = ${texNum(parallelL(L), 5)}\\ [H]`)] };
    },
  },
  {
    id: 'Energía en DC',
    subtopic: '5.5 DC',
    gen: (r) => {
      const E = pick(r, [10, 12, 24]);
      const R1 = pick(r, [2, 4, 6]);
      const R2 = pick(r, [2, 4, 8]);
      const L = pick(r, [0.1, 0.5, 1]);
      const C = pick(r, [100e-6, 220e-6]);
      const I = E / (R1 + R2);
      const VC = I * R2;
      return { prompt: `Una fuente de ${E} V alimenta R1 = ${R1} Ω en serie con L = ${L} H y R2 = ${R2} Ω; un capacitor de ${texNum(C * 1e6)} µF está en paralelo con R2. En régimen permanente, halle la energía en L y en C.`, answers: [{ label: 'W_L', value: 0.5 * L * I * I, unit: 'J' }, { label: 'W_C', value: 0.5 * C * VC * VC, unit: 'J' }], hints: ['L = corto, C = abierto.', 'I = E/(R1 + R2).'], solution: [P(`I = ${texNum(I)} A, V_C = ${texNum(VC)} V`), BOX(`W_L = ${texQ(0.5 * L * I * I, 'J')},\\ W_C = ${texQ(0.5 * C * VC * VC, 'J')}`)] };
    },
  },
];
