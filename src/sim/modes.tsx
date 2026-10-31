import React, { useMemo, useState } from 'react';
import { analyze, Analysis } from '../core/engine/analyze';
import { reduceNetwork, REdge } from '../core/engine/methods/reduce';
import { fmtEng, fmtNum, parseSI, texNum, texQ } from '../core/engine/units';
import { toTex } from '../core/engine/expr';
import { simplify } from 'mathjs';
import { Kpi, Plot, Tex, ThreePanels, usePreset } from '../core/ui/basic';
import { CircuitEditor } from '../core/ui/CircuitEditor';
import { DCMode, Tabs, usePendingTemplate } from '../core/ui/DCMode';
import { IssuesPanel, BetterDoc, BetterView, BOX, H, L, P, StepDoc, StepsView, T } from '../core/ui/panels';
import { PieceIn, PiecesEditor, toPieces } from '../core/ui/PiecesEditor';
import { useCircuitDoc } from '../core/ui/useCircuitDoc';
import { dcSolution } from '../core/solutions/dc';
import { dcEjemplo, dcEnergy, parallelInductors, redInductores, seriesCapacitors, seriesInductorsDivision, waveAnalysis } from './calc';
import { nodePositions, ReductionAnimation } from './stages';

const TITLES = ['Datos', 'Solución', 'Cómo resolverlo de una mejor manera'];
function simpTex(K: number, d: { toString(): string }): string {
  try {
    return toTex(simplify(`${K} * (${d.toString()})`));
  } catch {
    return '';
  }
}
const pn = (x: number) => (x < 0 ? `(${texNum(x, 5)})` : texNum(x, 5));

// =============== Formas de onda en L o C ===============
export function WaveMode({ elem }: { elem: 'L' | 'C' }) {
  const isL = elem === 'L';
  const [s, set] = usePreset(`u5-onda-${elem}`, {
    given: (isL ? 'i' : 'v') as 'i' | 'v',
    K: isL ? '10m' : '100µ',
    x0: '0',
    tEval: isL ? '1m' : '2m',
    pieces: (isL
      ? [{ from: '0', to: '2m', expr: '5000*t' }, { from: '2m', to: '4m', expr: '10' }, { from: '4m', to: '6m', expr: '10 - 5000*(t-0.004)' }]
      : [{ from: '0', to: '2m', expr: '5000*t' }, { from: '2m', to: 'inf', expr: '10' }]) as PieceIn[],
  });
  const K = parseSI(s.K, isL ? 'H' : 'F');
  const x0 = parseSI(s.x0, s.given === 'v' ? (isL ? 'A' : 'V') : isL ? 'A' : 'V');
  const tE = parseSI(s.tEval, 's');
  const tp = toPieces(s.pieces);
  const errs = [!K.ok ? `${elem}: ${K.error}` : '', !tE.ok ? `t*: ${tE.error}` : '', tp.error ?? ''].filter(Boolean) as string[];
  const derivative = (isL && s.given === 'i') || (!isL && s.given === 'v');
  if (!derivative && !x0.ok) errs.push(`Condición inicial: ${x0.error}`);
  const r = useMemo(() => (errs.length ? null : waveAnalysis(elem, s.given, tp.pieces, K.value!, x0.value ?? 0, tE.value!)), [s, errs.length]);
  const allErr = [...errs, ...(r && !r.ok ? [r.error!] : [])];
  const ok = r && r.ok ? r : null;
  const st = isL ? 'i_L' : 'v_C';
  const other = s.given === 'i' ? 'v' : 'i';
  const impulse = ok && ok.jumps.length > 0;
  const p1 = (
    <div className="col">
      <div className="row">
        <span>Dato:</span>
        <button className={s.given === 'i' ? 'active' : ''} onClick={() => set({ ...s, given: 'i' })}>
          i(t)
        </button>
        <button className={s.given === 'v' ? 'active' : ''} onClick={() => set({ ...s, given: 'v' })}>
          v(t)
        </button>
        <label className="row">
          {elem} = <input value={s.K} onChange={(e) => set({ ...s, K: e.target.value })} style={{ width: 80 }} aria-label={isL ? 'inductancia' : 'capacitancia'} />[{isL ? 'H' : 'F'}]
        </label>
      </div>
      <PiecesEditor pieces={s.pieces} onChange={(p) => set({ ...s, pieces: p })} varName={s.given} />
      <div className="row">
        {!derivative && (
          <label className="row">
            {isL ? 'i(t₀)' : 'v(t₀)'} = <input value={s.x0} onChange={(e) => set({ ...s, x0: e.target.value })} style={{ width: 70 }} aria-label="condición inicial" />[{isL ? 'A' : 'V'}]
          </label>
        )}
        <label className="row">
          Evaluar en t = <input value={s.tEval} onChange={(e) => set({ ...s, tEval: e.target.value })} style={{ width: 70 }} aria-label="instante" />s
        </label>
      </div>
      {allErr.length > 0 && (
        <div className="issue box-err" role="alert">
          <b className="tag">✖ Error</b> {allErr.join(' ')}
        </div>
      )}
      {impulse && (
        <div className="issue box-err" role="alert">
          <b className="tag">✖ Error físico: impulso</b> — {isL ? 'la corriente del inductor' : 'el voltaje del capacitor'} salta en t = {ok!.jumps.map((j) => fmtEng(j.t, 's')).join(', ')} (de {fmtEng(ok!.jumps[0].before, isL ? 'A' : 'V')} a {fmtEng(ok!.jumps[0].after, isL ? 'A' : 'V')}).
          <dl>
            <dt>Por qué</dt>
            <dd>{isL ? 'v = L·di/dt: un salto de i exige di/dt infinito, es decir, un voltaje infinito (impulso).' : 'i = C·dv/dt: un salto de v exige dv/dt infinito, es decir, una corriente infinita (impulso).'}</dd>
            <dt>Qué causaría</dt>
            <dd>{isL ? 'En un circuito real salta un arco (chispa) en el interruptor que intenta cortar la corriente.' : 'Una corriente enorme instantánea que puede dañar el capacitor o la fuente.'}</dd>
            <dt>Cómo corregirlo</dt>
            <dd>Haga que {isL ? 'i(t)' : 'v(t)'} sea continua: el valor final de un tramo debe ser igual al inicial del siguiente (use una rampa en lugar de un escalón).</dd>
          </dl>
        </div>
      )}
      {ok && (
        <>
          <Kpi
            items={[
              { l: `${s.given}(t*)`, v: fmtEng(ok.at.x, s.given === 'i' ? 'A' : 'V', 5) },
              { l: `${other}(t*)`, v: fmtEng(ok.at.y, other === 'i' ? 'A' : 'V', 5) },
              { l: 'p(t*) = v·i', v: fmtEng(ok.at.p, 'W', 5) },
              { l: `w(t*) = ½${isL ? 'Li²' : 'Cv²'}`, v: fmtEng(ok.at.w, 'J', 5) },
            ]}
          />
          <Plot series={[{ label: `${s.given}(t) [${s.given === 'i' ? 'A' : 'V'}] (dato)`, x: ok.ts, y: ok.x }]} xLabel="t [s]" height={160} vlines={[{ x: tE.value!, label: 't*' }]} />
          <Plot series={[{ label: `${other}(t) [${other === 'i' ? 'A' : 'V'}] (calculado)`, x: ok.ts, y: ok.y, stepped: false }]} xLabel="t [s]" height={160} vlines={[{ x: tE.value!, label: 't*' }]} />
          <Plot series={[{ label: 'p(t) [W]', x: ok.ts, y: ok.p }, { label: 'w(t) [J]', x: ok.ts, y: ok.w, fill: 'origin' }]} xLabel="t [s]" height={170} />
        </>
      )}
    </div>
  );
  let doc: StepDoc | null = null;
  if (ok) {
    const dev: StepDoc['development'] = [];
    if (derivative) {
      ok.pw.forEach((p, k) =>
        dev.push(T(`${s.given}(t) = ${toTex(p.node)} \\Rightarrow ${other}(t) = ${isL ? 'L' : 'C'}\\frac{d${s.given}}{dt} = ${texNum(K.value!, 5)}\\cdot\\left(${toTex(p.dnode)}\\right) = ${simpTex(K.value!, p.dnode)}\\ [${other === 'v' ? 'V' : 'A'}]\\quad (${isFinite(p.from) ? texNum(p.from) : '-\\infty'} \\le t < ${isFinite(p.to) ? texNum(p.to) : '\\infty'})`, `(${k + 1})`)),
      );
    } else {
      dev.push(T(`${other}(t) = ${other}(t_0) + \\frac{1}{${isL ? 'L' : 'C'}}\\int_{t_0}^{t} ${s.given}(\\tau)\\,d\\tau,\\quad ${other}(t_0) = ${texNum(x0.value ?? 0)}`, '(1)'));
      dev.push(P('La integral se evalúa tramo por tramo y el valor final de cada tramo es el inicial del siguiente (continuidad).'));
    }
    dev.push(T(`${other}(t^*) = ${texQ(ok.at.y, other === 'i' ? 'A' : 'V', 5)}`, `(${ok.pw.length + 1})`));
    dev.push(T(`p(t^*) = v\\,i = ${texQ(ok.at.p, 'W', 5)},\\qquad w(t^*) = \\tfrac12 ${isL ? 'L i^2' : 'C v^2'} = \\tfrac12\\cdot ${texNum(K.value!, 5)}\\cdot ${pn(isL ? (s.given === 'i' ? ok.at.x : ok.at.y) : s.given === 'v' ? ok.at.x : ok.at.y)}^2 = ${texQ(ok.at.w, 'J', 5)}`, `(${ok.pw.length + 2})`));
    if (impulse) dev.push(P(`⚠ ${st} salta en una frontera: allí ${other} sería un impulso (no físico). Corrija la forma de onda.`));
    doc = {
      title: isL ? 'Inductor: v = L di/dt' : 'Capacitor: i = C dv/dt',
      concept: isL ? 'El inductor se opone a los cambios de corriente: $v = L\\,di/dt$ y $i(t) = \\frac1L\\int v\\,dt + i(t_0)$. Su corriente no puede cambiar de golpe y almacena energía en su campo magnético: $w = \\tfrac12 L i^2$.' : 'El capacitor se opone a los cambios de voltaje: $i = C\\,dv/dt$ y $v(t) = \\frac1C\\int i\\,dt + v(t_0)$. Su voltaje no puede cambiar de golpe y almacena energía en su campo eléctrico: $w = \\tfrac12 C v^2$.',
      identification: [L([`$${elem} = ${texQ(K.value!, isL ? 'H' : 'F')}$`, ...ok.pw.map((p) => `${s.given}(t) = $${toTex(p.node)}$ para $${isFinite(p.from) ? texNum(p.from) : '-\\infty'} \\le t < ${isFinite(p.to) ? texNum(p.to) : '\\infty'}$ s`), `Instante: $t^* = ${texNum(tE.value!)}$ s`])],
      laws: [isL ? T('v = L\\frac{di}{dt},\\quad i(t) = \\frac{1}{L}\\int_{t_0}^{t} v\\,d\\tau + i(t_0),\\quad w = \\tfrac12 L i^2') : T('i = C\\frac{dv}{dt},\\quad v(t) = \\frac{1}{C}\\int_{t_0}^{t} i\\,d\\tau + v(t_0),\\quad w = \\tfrac12 C v^2')],
      development: dev,
      results: [BOX(`${other}(t^*) = ${texQ(ok.at.y, other === 'i' ? 'A' : 'V', 5)}`), BOX(`p(t^*) = ${texQ(ok.at.p, 'W', 5)},\\quad w(t^*) = ${texQ(ok.at.w, 'J', 5)}`)],
      verification: [P(`Unidades: ${isL ? '[H]·[A/s] = [V]' : '[F]·[V/s] = [A]'} ✓. La energía nunca es negativa (w ≥ 0) ✓; p > 0 mientras ${isL ? 'el inductor' : 'el capacitor'} se carga y p < 0 cuando devuelve energía.`)],
      tip: isL ? 'En cada tramo recto de i(t) el voltaje es constante e igual a L × pendiente. En los tramos planos (i constante) el voltaje es 0.' : 'En cada rampa de v(t) la corriente es constante e igual a C × pendiente. Donde v es constante, i = 0 (circuito abierto).',
    };
  }
  const better: BetterDoc = {
    method: derivative ? 'Pendiente por tramos (para funciones lineales) o derivada directa' : 'Área bajo la curva por tramos',
    why: 'Las formas de onda de los ejercicios suelen ser rectas: la derivada es la pendiente y la integral es el área de triángulos y rectángulos.',
    savings: 'Sin derivar ni integrar expresiones: geometría simple.',
    formulas: [{ tex: isL ? 'v = L\\,\\frac{\\Delta i}{\\Delta t}' : 'i = C\\,\\frac{\\Delta v}{\\Delta t}', meaning: 'Para un tramo recto.' }, { tex: isL ? '\\Delta i = \\frac{1}{L}\\,(\\text{área bajo } v)' : '\\Delta v = \\frac{1}{C}\\,(\\text{área bajo } i)', meaning: 'Integral como área.' }, { tex: isL ? 'w = \\tfrac12 L i^2' : 'w = \\tfrac12 C v^2', meaning: 'Energía almacenada (depende solo del valor actual).' }],
    tricks: ['La energía en un instante solo depende del valor de ' + (isL ? 'i' : 'v') + ' en ese instante, no de la historia.', 'Si la variable de estado vuelve a 0, toda la energía fue devuelta.'],
    mistakes: ['Olvidar la condición inicial al integrar.', `Permitir un salto en ${isL ? 'i_L' : 'v_C'} (exigiría un impulso).`],
    compare: { long: 'Derivar o integrar la expresión simbólica completa.', short: 'Pendientes y áreas por tramos.', result: ok ? `$${other}(t^*) = ${texQ(ok.at.y, other === 'i' ? 'A' : 'V', 5)}$.` : '—' },
  };
  return <ThreePanels titles={TITLES} p1={p1} p2={doc ? <StepsView doc={doc} /> : <div className="card box-err">Corrija los datos de la ventanilla 1.</div>} p3={<BetterView doc={better} />} />;
}

// =============== Redes de L o C (reducción animada) ===============
export function NetworkMode() {
  const doc = useCircuitDoc('u5-red', redInductores());
  usePendingTemplate('u5-red', doc.load);
  const [terms, setTerms] = useState<number[] | null>(null);
  const [picking, setPicking] = useState(false);
  const a = useMemo(() => analyze(doc.circuit), [doc.circuit]);
  const Ls = a.net.elements.filter((e) => e.kind === 'L');
  const Cs = a.net.elements.filter((e) => e.kind === 'C');
  const others = a.net.elements.filter((e) => e.kind !== 'L' && e.kind !== 'C');
  const kind: 'L' | 'C' | null = Ls.length && !Cs.length ? 'L' : Cs.length && !Ls.length ? 'C' : null;
  const errs: string[] = [];
  if (!Ls.length && !Cs.length) errs.push('Coloque inductores o capacitores.');
  if (Ls.length && Cs.length) errs.push('No mezcle inductores y capacitores: la reducción serie‑paralelo se hace con elementos del mismo tipo.');
  if (others.length) errs.push(`Esta herramienta solo reduce L o C; quite ${others.map((o) => o.label).join(', ')}.`);
  for (const ve of a.net.valueErrors) errs.push(ve.message);
  for (const e of [...Ls, ...Cs]) if (!(e.value > 0)) errs.push(`${e.label} debe ser positiva.`);
  // terminales por defecto: nodos con nombre a y b, o los dos primeros
  const def = (() => {
    const ia = a.net.nodeNames.indexOf('a');
    const ib = a.net.nodeNames.indexOf('b');
    if (ia >= 0 && ib >= 0) return [ia, ib];
    return a.net.nodeCount >= 2 ? [0, 1] : null;
  })();
  const st = terms ?? def;
  const edges: REdge[] = kind ? [...Ls, ...Cs].map((e) => ({ id: e.id, name: e.label, R: kind === 'L' ? e.value : 1 / e.value, a: e.n1, b: e.n2, from: [e.id] })) : [];
  const red = useMemo(() => (!errs.length && st && kind ? reduceNetwork(edges, st[0], st[1]) : null), [a, st?.[0], st?.[1], kind, errs.length]);
  const pos = useMemo(() => nodePositions(a), [a]);
  const unit = kind === 'C' ? 'F' : 'H';
  const show = (x: number) => (kind === 'C' ? 1 / x : x);
  const eqv = red?.ok ? show(red.Req) : NaN;
  const texFor = (s2: NonNullable<typeof red>['steps'][number]) => {
    const out = s2.outputs[0]?.replace('R_{', `${kind}_{`) ?? '';
    const ins = s2.inputs.map((x) => x.replace('R_{', `${kind}_{`));
    const val = s2.edges.find((e) => e.name === s2.outputs[0]);
    const v = val ? texQ(show(val.R), unit, 5) : '';
    if (s2.kind === 'serie') return kind === 'L' ? `${out} = ${ins.join(' + ')} = ${v}` : `\\frac{1}{${out}} = ${ins.map((x) => `\\frac{1}{${x}}`).join(' + ')} \\Rightarrow ${out} = ${v}`;
    if (s2.kind === 'paralelo') return kind === 'L' ? `\\frac{1}{${out}} = ${ins.map((x) => `\\frac{1}{${x}}`).join(' + ')} \\Rightarrow ${out} = ${v}` : `${out} = ${ins.join(' + ')} = ${v}`;
    return s2.tex;
  };
  const p1 = (
    <div className="col">
      <CircuitEditor doc={doc} palette={['L', 'C']} analysis={a} pick={picking ? { kind: 'node', count: 2, prompt: 'Toque los dos terminales a y b', onPick: (ids) => { setTerms(ids as number[]); setPicking(false); } } : null} highlightNodes={st ?? []} values={null} nodeV={null} />
      <div className="row">
        <button className="primary" onClick={() => setPicking(true)}>🎯 Elegir terminales</button>
        <span className="hint">Por defecto se usan los nodos llamados «a» y «b» (use «Nombrar»).</span>
      </div>
      {errs.length ? <IssuesPanel issues={errs.map((e) => ({ code: 'red', severity: 'error', what: e, why: 'La reducción serie‑paralelo combina elementos del mismo tipo entre dos terminales.', consequence: 'No se puede calcular el equivalente.', fix: 'Revise la red.', elements: [], nodes: [] }))} /> : null}
      {red && st && (
        <>
          <Kpi items={[{ l: `${kind}_eq entre los terminales`, v: red.ok ? fmtEng(eqv, unit, 5) : red.message ?? '—' }]} />
          <ReductionAnimation red={red} pos={pos} s={st[0]} t={st[1]} unit={unit} show={show} texFor={texFor} />
        </>
      )}
    </div>
  );
  const docS: StepDoc | null =
    red?.ok && kind
      ? {
          title: kind === 'L' ? 'Reducción de inductores' : 'Reducción de capacitores',
          concept: kind === 'L' ? 'Los inductores se combinan como las resistencias: en serie se suman y en paralelo se suman sus inversas.' : 'Los capacitores se combinan al revés que las resistencias: en PARALELO se suman y en SERIE se suman sus inversas.',
          identification: [L([...Ls, ...Cs].map((e) => `$${e.label} = ${texQ(e.value, unit)}$`))],
          laws: [kind === 'L' ? T('L_s = L_1 + L_2 + \\dots,\\qquad \\frac{1}{L_p} = \\frac{1}{L_1} + \\frac{1}{L_2} + \\dots') : T('C_p = C_1 + C_2 + \\dots,\\qquad \\frac{1}{C_s} = \\frac{1}{C_1} + \\frac{1}{C_2} + \\dots')],
          development: red.steps.map((x, k) => T(texFor(x), `(${k + 1})`)),
          results: [BOX(`${kind}_{eq} = ${texQ(eqv, unit, 5)}`)],
          verification: [P(kind === 'L' ? 'L_eq en paralelo es menor que la menor; en serie, mayor que la mayor ✓.' : 'C_eq en serie es menor que la menor; en paralelo, mayor que la mayor ✓.')],
          tip: kind === 'L' ? 'Inductores = resistencias (mismas fórmulas).' : 'Capacitores = resistencias «al revés»: la serie de C usa producto sobre suma.',
        }
      : null;
  const better: BetterDoc = {
    method: kind === 'C' ? 'Tratar 1/C como «resistencia»' : 'Mismas reglas que las resistencias',
    why: 'Así se reutilizan todas las técnicas de la Unidad 3.',
    savings: 'No hace falta memorizar fórmulas nuevas.',
    formulas: [{ tex: 'L_{eq} = \\frac{L_1L_2}{L_1+L_2}', meaning: 'Dos inductores en paralelo.' }, { tex: 'C_{eq} = \\frac{C_1C_2}{C_1+C_2}', meaning: 'Dos capacitores en serie.' }],
    tricks: ['Dos iguales en paralelo (L) o en serie (C): el valor a la mitad.'],
    mistakes: ['Sumar capacitores en serie.', 'Olvidar que la reducción solo vale entre los dos terminales elegidos.'],
    compare: { long: 'Escribir v = L di/dt de cada uno y combinar.', short: 'Reglas de serie‑paralelo.', result: red?.ok ? `$${kind}_{eq} = ${texQ(eqv, unit, 5)}$.` : '—' },
  };
  return <ThreePanels p1={p1} p2={docS ? <StepsView doc={docS} /> : <div className="card box-err">Arme una red de solo L o solo C y elija los terminales.</div>} p3={<BetterView doc={better} />} />;
}

// =============== Combinaciones con condiciones iniciales ===============
export function CombosMode() {
  const [tab, setTab] = useState<'Cserie' | 'Lparalelo' | 'Lserie'>('Cserie');
  const [s, set] = usePreset('u5-combos', { C: '200µ 50µ', v0: '0 0', V: '100', L: '0,5 1,5', i0: '1 -0,5', VL: '12' });
  const list = (t: string) => t.trim().split(/\s+|;|,(?=\s)/).filter(Boolean).map((x) => parseSI(x));
  const errs: string[] = [];
  let content: React.ReactNode = null;
  let doc: StepDoc | null = null;
  if (tab === 'Cserie') {
    const C = list(s.C);
    const v0 = list(s.v0);
    const V = parseSI(s.V, 'V');
    if (C.length < 2) errs.push('Escriba al menos dos capacitores.');
    if (v0.length !== C.length) errs.push('Escriba un voltaje inicial por cada capacitor (0 si están descargados).');
    if (!V.ok) errs.push(`V: ${V.error}`);
    C.forEach((c, i) => (!c.ok || c.value! <= 0 ? errs.push(`C${i + 1} debe ser un valor positivo.`) : null));
    if (!errs.length) {
      const r = seriesCapacitors(C.map((c) => c.value!), v0.map((x) => x.value ?? 0), V.value!);
      content = (
        <table className="data">
          <thead>
            <tr>
              <th>Capacitor</th>
              <th>V final</th>
              <th>ΔQ (común)</th>
              <th>Q final</th>
              <th>Energía</th>
            </tr>
          </thead>
          <tbody>
            {C.map((c, i) => (
              <tr key={i}>
                <td>C{i + 1} = {fmtEng(c.value!, 'F')}</td>
                <td>{fmtEng(r.Vk[i], 'V', 5)}</td>
                <td>{fmtEng(r.dQ, 'C', 5)}</td>
                <td>{fmtEng(r.Q[i], 'C', 5)}</td>
                <td>{fmtEng(r.W[i], 'J', 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
      doc = {
        title: 'Capacitores en serie: carga y división de voltaje',
        concept: 'En serie, todos los capacitores reciben la MISMA carga ΔQ (la corriente es la misma). Sus voltajes se reparten en proporción INVERSA a su capacitancia: $V_k = Q/C_k$.',
        identification: [L([...C.map((c, i) => `$C_${i + 1} = ${texQ(c.value!, 'F')}$, $v_${i + 1}(0) = ${texQ(v0[i].value ?? 0, 'V')}$`), `$V = ${texQ(V.value!, 'V')}$`])],
        laws: [T('\\frac{1}{C_{eq}} = \\sum\\frac{1}{C_k},\\quad \\Delta Q = C_{eq}(V - \\sum v_k(0)),\\quad V_k = v_k(0) + \\frac{\\Delta Q}{C_k}')],
        development: [T(`C_{eq} = ${texQ(r.Ceq, 'F', 5)}`, '(1)'), T(`\\Delta Q = ${texNum(r.Ceq, 5)}\\cdot(${texNum(V.value!)} - ${pn(r.V0eq)}) = ${texQ(r.dQ, 'C', 5)}`, '(2)'), ...r.Vk.map((v, i) => T(`V_${i + 1} = ${pn(v0[i].value ?? 0)} + \\frac{${texNum(r.dQ, 5)}}{${texNum(C[i].value!, 5)}} = ${texQ(v, 'V', 5)}`, `(${i + 3})`))],
        results: r.Vk.map((v, i) => BOX(`V_${i + 1} = ${texQ(v, 'V', 5)},\\ Q_${i + 1} = ${texQ(r.Q[i], 'C', 5)}`)),
        verification: [P(`LVK: $${r.Vk.map((v) => pn(v)).join(' + ')} = ${texNum(r.Vk.reduce((a, b) => a + b, 0), 6)} = V$ ✓.`)],
        tip: 'El capacitor MÁS PEQUEÑO toma el MAYOR voltaje. Con capacitores descargados: V_k = (C_eq/C_k)·V.',
      };
    }
  } else if (tab === 'Lparalelo') {
    const L0 = list(s.L);
    const i0 = list(s.i0);
    if (L0.length < 2) errs.push('Escriba al menos dos inductores.');
    if (i0.length !== L0.length) errs.push('Escriba una corriente inicial por inductor.');
    L0.forEach((c, i) => (!c.ok || c.value! <= 0 ? errs.push(`L${i + 1} debe ser positiva.`) : null));
    if (!errs.length) {
      const r = parallelInductors(L0.map((x) => x.value!), i0.map((x) => x.value ?? 0));
      content = <Kpi items={[{ l: 'L_eq', v: fmtEng(r.Leq, 'H', 5) }, { l: 'i_eq(0) = Σ i_k(0)', v: fmtEng(r.i0eq, 'A', 5) }]} />;
      doc = {
        title: 'Inductores en paralelo con corrientes iniciales',
        concept: 'En paralelo, los inductores tienen el mismo voltaje; la inductancia equivalente se halla como resistencias en paralelo y la corriente inicial equivalente es la suma de las corrientes iniciales.',
        identification: [L(L0.map((l, i) => `$L_${i + 1} = ${texQ(l.value!, 'H')}$, $i_${i + 1}(0) = ${texQ(i0[i].value ?? 0, 'A')}$`))],
        laws: [T('\\frac{1}{L_{eq}} = \\sum\\frac{1}{L_k},\\qquad i_{eq}(0) = \\sum i_k(0)')],
        development: [T(`L_{eq} = ${texQ(r.Leq, 'H', 5)}`, '(1)'), T(`i_{eq}(0) = ${i0.map((x) => pn(x.value ?? 0)).join(' + ')} = ${texQ(r.i0eq, 'A', 5)}`, '(2)')],
        results: [BOX(`L_{eq} = ${texQ(r.Leq, 'H', 5)},\\ i_{eq}(0) = ${texQ(r.i0eq, 'A', 5)}`)],
        verification: [P('L_eq es menor que el menor inductor ✓.')],
        tip: 'Dos inductores en paralelo: producto sobre suma, igual que las resistencias.',
      };
    }
  } else {
    const L0 = list(s.L);
    const V = parseSI(s.VL, 'V');
    if (L0.length < 2) errs.push('Escriba al menos dos inductores.');
    if (!V.ok) errs.push(`V: ${V.error}`);
    L0.forEach((c, i) => (!c.ok || c.value! <= 0 ? errs.push(`L${i + 1} debe ser positiva.`) : null));
    if (!errs.length) {
      const r = seriesInductorsDivision(L0.map((x) => x.value!), V.value!);
      content = <Kpi items={[{ l: 'L_eq', v: fmtEng(r.Leq, 'H', 5) }, ...r.Vk.map((v, i) => ({ l: `v_L${i + 1}`, v: fmtEng(v, 'V', 5) }))]} />;
      doc = {
        title: 'Inductores en serie',
        concept: 'En serie, los inductores llevan la misma corriente (mismo di/dt); el voltaje se reparte en proporción DIRECTA a la inductancia.',
        identification: [L([...L0.map((l, i) => `$L_${i + 1} = ${texQ(l.value!, 'H')}$`), `$v = ${texQ(V.value!, 'V')}$`])],
        laws: [T('L_{eq} = \\sum L_k,\\qquad v_k = \\frac{L_k}{L_{eq}}\\,v')],
        development: [T(`L_{eq} = ${texQ(r.Leq, 'H', 5)}`, '(1)'), ...r.Vk.map((v, i) => T(`v_${i + 1} = \\frac{${texNum(L0[i].value!)}}{${texNum(r.Leq)}}\\cdot ${texNum(V.value!)} = ${texQ(v, 'V', 5)}`, `(${i + 2})`))],
        results: r.Vk.map((v, i) => BOX(`v_${i + 1} = ${texQ(v, 'V', 5)}`)),
        verification: [P(`Suma: $${texNum(r.Vk.reduce((a, b) => a + b, 0), 6)} = v$ ✓.`)],
        tip: 'Es un divisor de voltaje con L en lugar de R.',
      };
    }
  }
  const p1 = (
    <div className="col">
      <Tabs value={tab} onChange={setTab} items={[{ id: 'Cserie', label: 'C en serie (carga y voltajes)' }, { id: 'Lparalelo', label: 'L en paralelo (corrientes iniciales)' }, { id: 'Lserie', label: 'L en serie (división de voltaje)' }]} />
      {tab === 'Cserie' && (
        <div className="col">
          <label className="row">C [F] <input value={s.C} onChange={(e) => set({ ...s, C: e.target.value })} style={{ flex: 1 }} aria-label="capacitores" /></label>
          <label className="row">v(0) [V] <input value={s.v0} onChange={(e) => set({ ...s, v0: e.target.value })} style={{ flex: 1 }} aria-label="voltajes iniciales" /></label>
          <label className="row">V aplicado [V] <input value={s.V} onChange={(e) => set({ ...s, V: e.target.value })} style={{ width: 90 }} /></label>
        </div>
      )}
      {tab !== 'Cserie' && (
        <div className="col">
          <label className="row">L [H] <input value={s.L} onChange={(e) => set({ ...s, L: e.target.value })} style={{ flex: 1 }} aria-label="inductores" /></label>
          {tab === 'Lparalelo' ? <label className="row">i(0) [A] <input value={s.i0} onChange={(e) => set({ ...s, i0: e.target.value })} style={{ flex: 1 }} /></label> : <label className="row">v aplicado [V] <input value={s.VL} onChange={(e) => set({ ...s, VL: e.target.value })} style={{ width: 90 }} /></label>}
        </div>
      )}
      {errs.length > 0 && (
        <div className="issue box-err" role="alert">
          <b className="tag">✖ Error</b> {errs.join(' ')}
        </div>
      )}
      {content}
      <p className="hint">Separe los valores con espacios (admite prefijos: 200µ 50µ).</p>
    </div>
  );
  const better: BetterDoc = {
    method: 'Pensar en la variable que se conserva',
    why: 'En serie se comparte la corriente (C: misma carga); en paralelo, el voltaje (L: mismo di/dt).',
    savings: 'Evita plantear LVK/LCK completas.',
    formulas: [{ tex: 'Q = C_{eq}V,\\quad V_k = Q/C_k', meaning: 'C en serie.' }, { tex: 'i_{eq}(0) = \\sum i_k(0)', meaning: 'L en paralelo.' }],
    tricks: ['C en serie descargados: V_k = (C_eq/C_k)·V.'],
    mistakes: ['Repartir el voltaje de C en serie en proporción directa a C (es inversa).'],
    compare: { long: 'Integrar i = C dv/dt de cada capacitor.', short: 'Carga común y V = Q/C.', result: 'los mismos voltajes.' },
  };
  return <ThreePanels titles={TITLES} p1={p1} p2={doc ? <StepsView doc={doc} /> : <div className="card box-err">Corrija los datos.</div>} p3={<BetterView doc={better} />} />;
}

// =============== DC con L y C ===============
export function DCEnergyMode() {
  return (
    <DCMode
      storageKey="u5-dc"
      palette={['R', 'V', 'I', 'L', 'C', 'AM', 'VM', 'GND']}
      initial={dcEjemplo()}
      methods={['nodos', 'mallas']}
      p1Extra={(a) => <EnergyTable a={a} />}
      solution={(a, m, sys) => {
        const base = dcSolution(a, m, sys);
        const en = dcEnergy(a);
        return {
          ...base,
          title: 'Régimen permanente DC con L y C',
          concept: 'En régimen permanente de corriente continua nada cambia en el tiempo: $di/dt = 0 \\Rightarrow v_L = 0$ (el inductor es un CORTOCIRCUITO) y $dv/dt = 0 \\Rightarrow i_C = 0$ (el capacitor es un CIRCUITO ABIERTO). Se resuelve el circuito resistivo resultante y luego la energía almacenada.',
          development: [P('Se reemplaza cada L por un cable y cada C por un circuito abierto:'), ...base.development, H('Energía almacenada'), ...en.map((x) => T(x.kind === 'L' ? `W_{${x.label}} = \\tfrac12 L i^2 = \\tfrac12\\cdot ${texNum(x.value, 5)}\\cdot ${pn(x.x)}^2 = ${texQ(x.W, 'J', 5)}` : `W_{${x.label}} = \\tfrac12 C v^2 = \\tfrac12\\cdot ${texNum(x.value, 5)}\\cdot ${pn(x.x)}^2 = ${texQ(x.W, 'J', 5)}`))],
          results: [...base.results, ...en.map((x) => BOX(`W_{${x.label}} = ${texQ(x.W, 'J', 5)}`))],
          tip: 'Primero dibuje el circuito DC equivalente (L → cable, C → abierto), resuélvalo y recién calcule las energías con i_L y v_C.',
        };
      }}
    />
  );
}
function EnergyTable({ a }: { a: Analysis }) {
  const en = dcEnergy(a);
  if (!a.dc || !en.length) return null;
  return (
    <div className="card">
      <h4>Energía almacenada en régimen permanente</h4>
      <table className="data">
        <thead>
          <tr>
            <th>Elemento</th>
            <th>{'i_L o v_C'}</th>
            <th>Energía</th>
          </tr>
        </thead>
        <tbody>
          {en.map((x) => (
            <tr key={x.id}>
              <td>{x.label} ({x.kind === 'L' ? 'corto en DC' : 'abierto en DC'})</td>
              <td>{x.kind === 'L' ? `i = ${fmtEng(x.x, 'A', 5)}` : `v = ${fmtEng(x.x, 'V', 5)}`}</td>
              <td>{fmtEng(x.W, 'J', 5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export { fmtNum };
