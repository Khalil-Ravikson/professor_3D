import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FiltroOneEuro, angulosDaMatriz, interpretar, criarPresenca, criarDetectorSorriso } from '../../src/camera.js';

test('One Euro: parado com ruído treme menos que a entrada; movimento rápido acompanha', () => {
  const f = new FiltroOneEuro({ minCutoff: 1, beta: 0.05 });
  let ruidoEntrada = 0, ruidoSaida = 0, anterior = null;
  for (let i = 0; i < 300; i++) {
    const t = i / 30;
    const entrada = 0.5 + (i % 2 ? 0.01 : -0.01);
    const s = f.filtrar(entrada, t);
    if (i > 30) { ruidoEntrada += 0.02; if (anterior !== null) ruidoSaida += Math.abs(s - anterior); }
    anterior = s;
  }
  assert.ok(ruidoSaida < ruidoEntrada * 0.25, `tremor ${ruidoSaida.toFixed(3)} vs ${ruidoEntrada.toFixed(3)}`);
  const g = new FiltroOneEuro({ minCutoff: 1, beta: 0.5 });
  let s = 0;
  for (let i = 0; i <= 15; i++) s = g.filtrar(i < 5 ? 0 : 1, i / 30); // salto de 0 para 1
  assert.ok(s > 0.9, `depois de 1/3 s chegou em ${s.toFixed(2)}`);
});

test('angulosDaMatriz: identidade e yaw de 30 graus', () => {
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const a = angulosDaMatriz(id);
  assert.ok(Math.abs(a.yaw) < 1e-9 && Math.abs(a.pitch) < 1e-9 && Math.abs(a.roll) < 1e-9);
  const t = Math.PI / 6, c = Math.cos(t), s = Math.sin(t);
  // Rotação em Y, coluna-maior: col0 = (c, 0, -s), col1 = (0,1,0), col2 = (s, 0, c)
  const ry = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  assert.ok(Math.abs(angulosDaMatriz(ry).yaw - t) < 1e-9);
});

test('interpretar: sem rosto e com rosto', () => {
  assert.deepEqual(interpretar({ faceLandmarks: [] }), { presente: false });
  const lm = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }));
  lm[1] = { x: 0.3, y: 0.4, z: 0 };
  const r = interpretar({
    faceLandmarks: [lm],
    faceBlendshapes: [{ categories: [{ categoryName: 'mouthSmileLeft', score: 0.8 }, { categoryName: 'mouthSmileRight', score: 0.6 }, { categoryName: 'jawOpen', score: 0.2 }] }],
    facialTransformationMatrixes: [],
  });
  assert.equal(r.presente, true);
  assert.equal(r.x, 0.3);
  assert.ok(Math.abs(r.sorriso - 0.7) < 1e-9);
  assert.equal(r.boca, 0.2);
  assert.equal(r.angulos, null);
});

test('presença com histerese: aparece em 0,5 s, some só depois de 8 s', () => {
  const p = criarPresenca();
  assert.equal(p.atualizar(true, 0), null);
  assert.equal(p.atualizar(true, 0.6), 'apareceu');
  assert.equal(p.atualizar(false, 1), null);
  assert.equal(p.atualizar(true, 2), null, 'piscar de detecção não derruba a presença');
  assert.equal(p.atualizar(false, 3), null);
  assert.equal(p.atualizar(false, 10), null);
  assert.equal(p.atualizar(false, 11.1), 'sumiu');
});

test('sorriso sustentado dispara uma vez e respeita o intervalo', () => {
  const d = criarDetectorSorriso();
  assert.equal(d.atualizar(0.9, 0), false);
  assert.equal(d.atualizar(0.9, 0.35), true);
  assert.equal(d.atualizar(0.9, 1), false);
  assert.equal(d.atualizar(0.9, 2), false, 'ainda no intervalo');
  assert.equal(d.atualizar(0.2, 3), false);
  assert.equal(d.atualizar(0.9, 5), false);
  assert.equal(d.atualizar(0.9, 5.4), true);
});
