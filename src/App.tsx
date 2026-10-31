import React from 'react';
import { sendPreset, Shell } from './core/ui/basic';
import { sendTemplate } from './core/ui/DCMode';
import { LearnView, PracticeView } from './core/ui/Practice';
import { CircuitPreview } from './core/ui/CircuitPreview';
import { CombosMode, DCEnergyMode, NetworkMode, WaveMode } from './sim/modes';
import { GENS, GLOSSARY, LEARN } from './sim/content';
import { dcEjemplo, redCapacitores, redInductores } from './sim/calc';

const PRESETS = [
  { name: 'Inductor: corriente trapezoidal', desc: 'Rampas de 5 A/ms con L = 10 mH: v = ±50 V en las rampas y 0 en el tramo plano.', key: 'u5-onda-L', mode: 'L', value: { given: 'i', K: '10m', x0: '0', tEval: '1m', pieces: [{ from: '0', to: '2m', expr: '5000*t' }, { from: '2m', to: '4m', expr: '10' }, { from: '4m', to: '6m', expr: '10 - 5000*(t-0.004)' }] } },
  { name: 'Inductor: corriente con un salto (error)', desc: 'La corriente pasa de 0 a 5 A de golpe: el simulador avisa que haría falta un impulso de voltaje.', key: 'u5-onda-L', mode: 'L', value: { given: 'i', K: '10m', x0: '0', tEval: '1m', pieces: [{ from: '-inf', to: '0', expr: '0' }, { from: '0', to: 'inf', expr: '5' }] } },
  { name: 'Capacitor: carga exponencial', desc: 'v(t) = 10(1 − e^(−t/τ)) con τ = 1 ms y C = 100 µF.', key: 'u5-onda-C', mode: 'C', value: { given: 'v', K: '100µ', x0: '0', tEval: '1m', pieces: [{ from: '0', to: 'inf', expr: '10*(1-exp(-t/0.001))' }] } },
  { name: 'Capacitor: corriente pulsante', desc: 'Dato i(t) por tramos: v(t) = (1/C)∫i dt + v(0).', key: 'u5-onda-C', mode: 'C', value: { given: 'i', K: '100µ', x0: '2', tEval: '3m', pieces: [{ from: '0', to: '2m', expr: '0.5' }, { from: '2m', to: '4m', expr: '-0.25' }] } },
];
const CIRCS = [
  { name: 'Red de inductores (estilo del material)', desc: 'L2 ∥ L3, luego ∥ L4 y en serie con L1.', circuit: redInductores, key: 'u5-red', mode: 'red' },
  { name: 'Red de capacitores', desc: 'C1 en serie con (C2 ∥ C3).', circuit: redCapacitores, key: 'u5-red', mode: 'red' },
  { name: 'Circuito DC con L y C', desc: 'L = corto, C = abierto; energía almacenada.', circuit: dcEjemplo, key: 'u5-dc', mode: 'dc' },
];

export default function App() {
  return (
    <Shell
      number={5}
      title="Inductancia y Capacitancia"
      modes={[
        { id: 'L', title: '5.1 Inductor v = L di/dt', render: () => <WaveMode elem="L" /> },
        { id: 'C', title: '5.2 Capacitor i = C dv/dt', render: () => <WaveMode elem="C" /> },
        { id: 'red', title: '5.4 Redes de L o C (reducción)', render: () => <NetworkMode /> },
        { id: 'combos', title: '5.4 Condiciones iniciales y división', render: () => <CombosMode /> },
        { id: 'dc', title: '5.5–5.6 Comportamiento en DC y energía', render: () => <DCEnergyMode /> },
      ]}
      learn={<LearnView sections={LEARN} glossary={GLOSSARY} />}
      practice={<PracticeView gens={GENS} storageKey="sim5" />}
      templates={() => (
        <div className="grid2">
          {PRESETS.map((p, i) => (
            <div key={`p${i}`} className="card">
              <b>{p.name}</b>
              <p className="small">{p.desc}</p>
              <button className="primary" onClick={() => sendPreset(p.key, p.value, p.mode)}>
                Cargar en la ventanilla 1
              </button>
            </div>
          ))}
          {CIRCS.map((t, i) => (
            <div key={i} className="card">
              <b>{t.name}</b>
              <p className="small">{t.desc}</p>
              <CircuitPreview circuit={t.circuit()} height={140} showNodes={false} />
              <button className="primary" onClick={() => sendTemplate(t.key, t.circuit(), t.mode)}>
                Cargar en la ventanilla 1
              </button>
            </div>
          ))}
        </div>
      )}
    />
  );
}
