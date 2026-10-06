// P8: medição de volume, normalização por frase e mesa de som (volume, mudo, fundo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medirBuffer, planejarNormalizacao, criarMesa, curvaVolume, ALVO, FATOR_FUNDO } from '../../src/audio.js';

// Buffer com a forma que medirBuffer usa. Seno, porque o RMS tem valor conhecido:
// amplitude / raiz de 2, ou seja, amplitude em dB menos 3,01 dB.
function seno({ amplitude = 0.5, segundos = 0.5, taxa = 24000, canais = 1 } = {}) {
  const n = Math.round(segundos * taxa);
  const dados = Array.from({ length: canais }, () => new Float32Array(n));
  for (let c = 0; c < canais; c++) {
    for (let i = 0; i < n; i++) dados[c][i] = amplitude * Math.sin((2 * Math.PI * 220 * i) / taxa);
  }
  return { numberOfChannels: canais, length: n, duration: segundos, sampleRate: taxa, getChannelData: (c) => dados[c] };
}

function silencio({ segundos = 0.2, taxa = 24000 } = {}) {
  const n = Math.round(segundos * taxa);
  const dados = new Float32Array(n);
  return { numberOfChannels: 1, length: n, duration: segundos, sampleRate: taxa, getChannelData: () => dados };
}

// GainNode de mentira: guarda cada rampa pedida e já salta para o alvo, porque
// aqui não há tempo de áudio passando.
function ganhoFalso() {
  const chamadas = [];
  return {
    gain: {
      value: 1,
      linearRampToValueAtTime(alvo, quando) { chamadas.push({ alvo, quando }); this.value = alvo; },
      cancelAndHoldAtTime() {},
    },
    get chamadas() { return chamadas; },
  };
}

test('medirBuffer: RMS de um seno fica 3,01 dB abaixo do pico', () => {
  const m = medirBuffer(seno({ amplitude: 0.5 }));
  // 0,5 em dBFS é -6,02; o RMS do seno é -9,03.
  assert.ok(Math.abs(m.picoDb - -6.02) < 0.1, `pico ${m.picoDb}`);
  assert.ok(Math.abs(m.rmsDb - -9.03) < 0.1, `rms ${m.rmsDb}`);
});

test('medirBuffer: gravação inteira abaixo do piso é medida sem a porta', () => {
  const m = medirBuffer(seno({ amplitude: 0.0005 })); // -66 dBFS, abaixo do piso de -60
  assert.equal(m.comPorta, false);
  assert.ok(Math.abs(m.rmsDb - -69.07) < 0.2, `rms ${m.rmsDb}`);
});

test('medirBuffer: silêncio não devolve número', () => {
  const m = medirBuffer(silencio());
  assert.equal(m.rmsDb, -Infinity);
  assert.equal(m.picoDb, -Infinity);
  assert.equal(m.aproveitado, 0);
});

test('medirBuffer: a porta de silêncio tira as amostras abaixo do piso do RMS', () => {
  // Metade do buffer é fala, metade é quase silêncio a -80 dBFS.
  const taxa = 24000, n = taxa;
  const dados = new Float32Array(n);
  for (let i = 0; i < n; i++) dados[i] = (i < n / 2 ? 0.5 : 0.0001) * Math.sin((2 * Math.PI * 220 * i) / taxa);
  const b = { numberOfChannels: 1, length: n, duration: 1, sampleRate: taxa, getChannelData: () => dados };
  const m = medirBuffer(b);
  // Sem a porta, o RMS cairia cerca de 3 dB por causa da metade muda.
  assert.ok(Math.abs(m.rmsDb - -9.03) < 0.3, `rms ${m.rmsDb}`);
  assert.ok(m.aproveitado > 0.4 && m.aproveitado < 0.6, `aproveitado ${m.aproveitado}`);
});

test('planejarNormalizacao: leva o RMS ao alvo quando há folga de pico', () => {
  // Seno a 0,05: pico -26 dBFS, RMS -29 dBFS. Precisa de uns +9 dB.
  const p = planejarNormalizacao(seno({ amplitude: 0.05 }));
  assert.equal(p.motivo, 'alvo de RMS');
  assert.equal(p.depois.rmsDb, ALVO.rmsDb);
  assert.ok(p.depois.picoDb <= ALVO.tetoPicoDb, `pico depois ${p.depois.picoDb}`);
});

test('planejarNormalizacao: o teto de pico ganha do alvo de RMS', () => {
  // Seno quase no fundo de escala: o RMS pede corte, não ganho, então o teto não
  // trava. Um sinal com pico alto e RMS baixo é o caso que trava: pulso curto.
  const taxa = 24000, n = taxa;
  const dados = new Float32Array(n);
  for (let i = 0; i < n; i++) dados[i] = 0.02 * Math.sin((2 * Math.PI * 220 * i) / taxa);
  dados[100] = 0.99; // estalo
  const b = { numberOfChannels: 1, length: n, duration: 1, sampleRate: taxa, getChannelData: () => dados };
  const p = planejarNormalizacao(b);
  assert.equal(p.motivo, 'limitado pelo teto de pico');
  assert.ok(Math.abs(p.depois.picoDb - ALVO.tetoPicoDb) < 0.05, `pico depois ${p.depois.picoDb}`);
  assert.ok(p.depois.rmsDb < ALVO.rmsDb, 'o RMS fica abaixo do alvo, e isso é o certo');
});

test('planejarNormalizacao: o ganho máximo trava um áudio quase mudo', () => {
  const p = planejarNormalizacao(seno({ amplitude: 0.0005 }));
  assert.equal(p.motivo, 'limitado pelo ganho máximo');
  assert.equal(p.ganhoDb, ALVO.ganhoMaxDb);
});

test('planejarNormalizacao: silêncio passa sem ganho', () => {
  const p = planejarNormalizacao(silencio());
  assert.equal(p.ganho, 1);
  assert.equal(p.motivo, 'sem som');
});

test('planejarNormalizacao: dois volumes diferentes chegam no mesmo RMS', () => {
  const a = planejarNormalizacao(seno({ amplitude: 0.5 }));
  const b = planejarNormalizacao(seno({ amplitude: 0.1 }));
  assert.equal(a.depois.rmsDb, b.depois.rmsDb);
});

test('curvaVolume: meio curso soa pela metade, não a 70 por cento', () => {
  assert.equal(curvaVolume(0), 0);
  assert.equal(curvaVolume(1), 1);
  assert.ok(Math.abs(curvaVolume(0.5) - 0.25) < 1e-9);
  assert.equal(curvaVolume(2), 1, 'fora da faixa, limita');
  assert.equal(curvaVolume(-1), 0);
});

test('mesa: volume, mudo e fundo abaixado se combinam no ganho de saída', () => {
  const saida = ganhoFalso();
  const ctx = { currentTime: 0 };
  const vistos = [];
  const mesa = criarMesa({ ctx, saida, volumeInicial: 0.8, aoMudar: (m) => vistos.push(m) });

  assert.ok(Math.abs(saida.gain.value - curvaVolume(0.8)) < 1e-9, 'aplica o volume inicial na criação');
  assert.equal(vistos.length, 1, 'avisa a interface na criação');

  mesa.definirVolume(0.5);
  assert.ok(Math.abs(saida.gain.value - 0.25) < 1e-9);

  mesa.abaixarFundo(true);
  assert.ok(Math.abs(saida.gain.value - 0.25 * FATOR_FUNDO) < 1e-9, 'microfone aberto: cai para o fator de fundo');
  assert.equal(mesa.fundoAbaixado, true);

  mesa.abaixarFundo(false);
  assert.ok(Math.abs(saida.gain.value - 0.25) < 1e-9, 'microfone fechado: volta ao volume do usuário');

  assert.equal(mesa.alternarMudo(), true);
  assert.equal(saida.gain.value, 0);
  assert.equal(mesa.volume, 0.5, 'o mudo não apaga o volume escolhido');

  mesa.definirVolume(0.7);
  assert.equal(mesa.mudo, false, 'mexer no controle tira do mudo');
  assert.ok(Math.abs(saida.gain.value - curvaVolume(0.7)) < 1e-9);

  assert.ok(saida.chamadas.length >= 5, 'cada mudança vira uma rampa');
  assert.ok(saida.chamadas.every((c) => c.quando > 0), 'a rampa termina depois de agora, não é degrau seco');
});

test('mesa: guarda as medidas de cada frase normalizada, com limite', () => {
  const mesa = criarMesa({ ctx: { currentTime: 0 }, saida: ganhoFalso() });
  for (let i = 0; i < 65; i++) mesa.normalizar(seno({ amplitude: 0.2, segundos: 0.05 }), `frase ${i}`);
  const m = mesa.medidas;
  assert.equal(m.length, 60, 'mantém as últimas 60');
  assert.equal(m[m.length - 1].rotulo, 'frase 64');
  assert.ok(m[0].antes.rmsDb < 0 && m[0].depois.rmsDb === ALVO.rmsDb);
});
