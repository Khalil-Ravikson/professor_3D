import test from 'node:test';
import assert from 'node:assert/strict';
import { flexaoDoDedo, retargetMao, emparelharMaos, dirDaMao, DEDOS } from '../../src/corpo/maos.js';
import { criarMovimento, medidaDoCorpo, LIMITES_MOV } from '../../src/corpo/movimento.js';
import { criarDetectorGestos } from '../../src/corpo/gestos-usuario.js';
import { qAngulo } from '../../src/corpo/matematica.js';

// Mão sintética (mundo, metros, y para baixo): dedos saem do pulso em +x; cada junta dobra `rad` em volta de z.
function mao(rad = [0, 0, 0]) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (let k = 1; k <= 4; k++) lm[k] = { x: 0.03 * k, y: 0, z: 0.02 * k }; // polegar estendido: pontos alinhados com o pulso
  let i = 0;
  for (const [nome, [mcp, pip, dip, tip]] of Object.entries(DEDOS)) {
    const yoff = 0 * (i++); // palma e dedos no mesmo plano: o ângulo entre palma e primeiro segmento é só a dobra
    lm[mcp] = { x: 0.09, y: yoff, z: 0 };
    let ang = 0, p = lm[mcp];
    for (const [idx, r] of [[pip, rad[0]], [dip, rad[1]], [tip, rad[2]]]) {
      ang += r;
      p = { x: p.x + 0.035 * Math.cos(ang), y: p.y + 0.035 * Math.sin(ang), z: 0 };
      lm[idx] = p;
    }
  }
  return lm;
}
const base = (v) => ({ x: 0, y: 0, z: 0, visibility: 1, ...v });
function poseNorm(over = {}) {
  const p = Array.from({ length: 33 }, () => base({ x: 0.5, y: 0.5 }));
  p[11] = base({ x: 0.4, y: 0.4 }); p[12] = base({ x: 0.6, y: 0.4 });
  p[13] = base({ x: 0.35, y: 0.55 }); p[14] = base({ x: 0.65, y: 0.55 });
  p[15] = base({ x: 0.3, y: 0.7 }); p[16] = base({ x: 0.7, y: 0.7 });
  for (const [i, v] of Object.entries(over)) p[i] = { ...p[i], ...v };
  return p;
}

test('flexão dos dedos: mão aberta dá zero e as juntas dobram o ângulo certo', () => {
  const aberta = flexaoDoDedo(mao([0, 0, 0]), DEDOS.Index);
  assert.ok(aberta.prox < 0.02 && aberta.inter < 0.02 && aberta.dist < 0.02);
  const f = flexaoDoDedo(mao([1.2, 1.0, 0.8]), DEDOS.Middle);
  assert.ok(Math.abs(f.prox - 1.2) < 0.02, `prox ${f.prox}`);
  assert.ok(Math.abs(f.inter - 1.0) < 0.02 && Math.abs(f.dist - 0.8) < 0.02);
  const alem = flexaoDoDedo(mao([2.5, 2.5, 2.5]), DEDOS.Ring);
  assert.ok(alem.prox <= 1.57 + 1e-6 && alem.inter <= 1.9 + 1e-6 && alem.dist <= 1.4 + 1e-6, 'respeita o limite de cada junta');
});
test('retarget da mão: nomes dos ossos, sinal da dobra por lado e mão aberta sem rotação', () => {
  const punho = retargetMao(mao([1.2, 1.2, 1.2]), 'esq');
  for (const n of ['leftIndexProximal', 'leftMiddleIntermediate', 'leftLittleDistal', 'leftRingProximal', 'leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal']) assert.ok(punho[n], n);
  assert.ok(punho.leftIndexProximal[2] < 0, 'esquerda dobra com z negativo');
  assert.ok(retargetMao(mao([1.2, 1.2, 1.2]), 'dir').rightIndexProximal[2] > 0, 'direita dobra com z positivo');
  assert.ok(Math.abs(qAngulo(punho.leftIndexProximal) - 1.2) < 0.03);
  const aberta = retargetMao(mao(), 'dir');
  assert.ok(Object.values(aberta).every((q) => qAngulo(q) < 0.1), 'mão aberta: nenhum osso gira');
});
test('mãos vão para o pulso mais próximo, sem confiar no rótulo, e nunca duas para o mesmo pulso', () => {
  const w = (x, y) => Array.from({ length: 21 }, (_, i) => ({ x: i === 0 ? x : 0, y: i === 0 ? y : 0, z: 0 }));
  const m1 = { mundo: ['mundo1'], norm: w(0.31, 0.69) }, m2 = { mundo: ['mundo2'], norm: w(0.69, 0.71) };
  const r = emparelharMaos([m2, m1], poseNorm());
  assert.deepEqual([r.esq, r.dir], [['mundo1'], ['mundo2']]); // esq = pulso 15 (x 0.3), dir = pulso 16 (x 0.7)
  const longe = emparelharMaos([{ mundo: ['longe'], norm: w(0.05, 0.05) }], poseNorm());
  assert.deepEqual([longe.esq, longe.dir], [null, null]);
  const duas = emparelharMaos([m1, { mundo: ['outra'], norm: w(0.32, 0.7) }], poseNorm());
  assert.ok(duas.esq && !duas.dir, 'a segunda mão perto do mesmo pulso não ocupa o outro lado');
});

test('movimento: zona morta, limite, espelho e retorno ao centro', () => {
  const norm = (cx, esc = 0.2) => { const p = poseNorm(); p[11] = base({ x: cx - esc / 2, y: 0.4 }); p[12] = base({ x: cx + esc / 2, y: 0.4 }); return p; };
  const b = medidaDoCorpo(norm(0.5));
  const mov = criarMovimento();
  let r; for (let i = 0; i < 80; i++) r = mov.calcular(norm(0.5), b, true, 1 / 30);
  assert.ok(Math.abs(r.x) < 1e-6 && Math.abs(r.z) < 1e-6, 'parado: zero');
  for (let i = 0; i < 80; i++) r = mov.calcular(norm(0.51), b, true, 1 / 30); // 0,01 de imagem = 2 cm: dentro da zona morta de 3 cm
  assert.ok(Math.abs(r.x) < 1e-6, 'tremor pequeno é ignorado');
  for (let i = 0; i < 120; i++) r = mov.calcular(norm(0.6), b, true, 1 / 30); // 0,1 de imagem = 20 cm, menos 3 cm da zona morta
  assert.ok(Math.abs(r.x + 0.17) < 0.01, `espelho: andou para -x, ${r.x.toFixed(3)}`);
  const direto = criarMovimento(); for (let i = 0; i < 120; i++) r = direto.calcular(norm(0.6), b, false, 1 / 30);
  assert.ok(Math.abs(r.x - 0.17) < 0.01, 'direto: para +x');
  const longe = criarMovimento(); for (let i = 0; i < 200; i++) r = longe.calcular(norm(0.95), b, false, 1 / 30);
  assert.ok(Math.abs(r.x - LIMITES_MOV.lateral) < 1e-3, 'limite de 30 cm para os lados');
  for (let i = 0; i < 200; i++) r = longe.calcular(null, b, false, 1 / 30);
  assert.ok(Math.abs(r.x) < 0.01, 'sem pessoa, volta ao centro');
  const perto = criarMovimento(); for (let i = 0; i < 200; i++) r = perto.calcular(norm(0.5, 0.5), b, true, 1 / 30);
  assert.ok(r.z > 0 && r.z <= LIMITES_MOV.profundidade + 1e-6, 'mais perto da câmera: para a frente, com limite');
});

function acenar(det, t0, { acima = true, n = 40 } = {}) {
  let ev = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 33;
    const x = 0.3 + 0.05 * Math.sin(i * 1.1); // oscila ±5% da imagem
    ev = ev.concat(det.alimentar({ t, norm: poseNorm({ 15: { x, y: acima ? 0.5 : 0.7 } }) }));
  }
  return ev;
}
test('aceno do usuário: precisa do pulso acima do cotovelo oscilando, tem intervalo mínimo e some sem oscilação', () => {
  assert.deepEqual(acenar(criarDetectorGestos(), 0), ['aceno']);
  const det = criarDetectorGestos();
  assert.deepEqual(acenar(det, 0), ['aceno']);
  assert.deepEqual(acenar(det, 2000), [], 'dentro do intervalo de 8 s não dispara de novo');
  assert.deepEqual(acenar(det, 12000), ['aceno'], 'depois do intervalo dispara');
  assert.deepEqual(acenar(criarDetectorGestos(), 0, { acima: false }), [], 'pulso abaixo do cotovelo não é aceno');
  const parado = criarDetectorGestos(); let ev = [];
  for (let i = 0; i < 60; i++) ev = ev.concat(parado.alimentar({ t: i * 33, norm: poseNorm({ 15: { x: 0.3, y: 0.5 } }) }));
  assert.ok(!ev.includes('aceno'), 'mão parada não é aceno');
});
test('mão levantada: pulso acima do ombro por 0,8 s dispara o convite uma vez', () => {
  const det = criarDetectorGestos(); let ev = [];
  for (let i = 0; i < 80; i++) ev = ev.concat(det.alimentar({ t: i * 33, norm: poseNorm({ 16: { x: 0.7, y: 0.25 } }) }));
  assert.deepEqual(ev, ['convite']);
  const baixa = criarDetectorGestos(); ev = [];
  for (let i = 0; i < 80; i++) ev = ev.concat(baixa.alimentar({ t: i * 33, norm: poseNorm() }));
  assert.deepEqual(ev, []);
});
test('joinha: polegar para cima e dedos fechados por 5 quadros', () => {
  const joinha = () => { const m = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })); m[2] = { x: 0.02, y: 0, z: 0 }; m[4] = { x: 0.02, y: -0.06, z: 0 };
    for (const [pip, tip] of [[6, 8], [10, 12], [14, 16], [18, 20]]) { m[pip] = { x: 0.05, y: 0.01, z: 0 }; m[tip] = { x: 0.02, y: 0.02, z: 0 }; } return m; };
  const aberta = () => { const m = joinha(); m[4] = { x: 0.06, y: 0.0, z: 0 }; for (const tip of [8, 12, 16, 20]) m[tip] = { x: 0.1, y: 0, z: 0 }; return m; };
  const det = criarDetectorGestos(); let ev = [];
  for (let i = 0; i < 4; i++) ev = ev.concat(det.alimentar({ t: i * 33, norm: poseNorm(), maos: { esq: joinha(), dir: null } }));
  assert.deepEqual(ev, [], 'quatro quadros não bastam');
  ev = ev.concat(det.alimentar({ t: 4 * 33, norm: poseNorm(), maos: { esq: joinha(), dir: null } }));
  assert.deepEqual(ev, ['joinha']);
  const nao = criarDetectorGestos(); ev = [];
  for (let i = 0; i < 20; i++) ev = ev.concat(nao.alimentar({ t: i * 33, norm: poseNorm(), maos: { esq: aberta(), dir: null } }));
  assert.deepEqual(ev, []);
});

test('mão não troca de lado: a que continua perto de onde estava fica no lado dela, mesmo se o pulso da pose pular', () => {
  const w = (x, y) => Array.from({ length: 21 }, (_, i) => ({ x: i === 0 ? x : 0, y: i === 0 ? y : 0, z: 0 }));
  const mao = { mundo: ['m'], norm: w(0.5, 0.5) };
  // o pulso 15 da pose caiu em cima da mão, mas ela estava no lado direito no quadro anterior
  const pose = poseNorm({ 15: { x: 0.52, y: 0.5 }, 16: { x: 0.9, y: 0.9 } });
  const sem = emparelharMaos([mao], pose);
  assert.ok(sem.esq, 'sem memória, vai para o pulso mais perto (esq)');
  const com = emparelharMaos([mao], pose, { anterior: { esq: null, dir: { x: 0.5, y: 0.5 } } });
  assert.ok(com.dir && !com.esq, 'com memória, fica na direita');
  assert.deepEqual(com.pulsos.dir, { x: 0.5, y: 0.5 });
});
test('sem pulso visível na pose, vale o rótulo TROCADO (o rótulo assume imagem espelhada)', () => {
  const w = (x, y) => Array.from({ length: 21 }, (_, i) => ({ x: i === 0 ? x : 0, y: i === 0 ? y : 0, z: 0 }));
  const pose = poseNorm({ 15: { visibility: 0.05 }, 16: { visibility: 0.05 } });
  const r = emparelharMaos([{ mundo: ['a'], norm: w(0.4, 0.6), rotulo: 'Left' }], pose);
  assert.ok(r.dir && !r.esq, '"Left" no vídeo não espelhado é a mão direita da pessoa');
  const r2 = emparelharMaos([{ mundo: ['b'], norm: w(0.4, 0.6), rotulo: 'Right' }], pose);
  assert.ok(r2.esq && !r2.dir);
  assert.deepEqual(emparelharMaos([{ mundo: ['c'], norm: w(0.4, 0.6), rotulo: null }], pose), { esq: null, dir: null, pulsos: { esq: null, dir: null } });
});
test('direção da mão vem dos pontos da própria mão e é nula sem dados', () => {
  const lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  lm[9] = { x: 0.02, y: -0.09, z: 0.01 };
  assert.deepEqual(dirDaMao(lm), [0.02, -0.09, 0.01]);
  assert.equal(dirDaMao(null), null);
  assert.equal(dirDaMao(Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))), null);
});

// ---- Torção do punho e dedos mais estáveis (prompt 7, melhoria pós-teste real) ----
import { qComTorcao, retargetBracos } from '../../src/corpo/retarget.js';
import { ladoDaMao } from '../../src/corpo/maos.js';
import { qRotaciona, qEixoAngulo, qMul, qConj, norm } from '../../src/corpo/matematica.js';

test('torção do punho: girar a mão em volta do antebraço devolve esse ângulo, com o sinal certo', () => {
  const frente = [1, 0, 0], lado = [0, 0, 1];
  for (const graus of [-80, -30, 0, 45, 90]) {
    const rad = (graus * Math.PI) / 180;
    const q = qComTorcao(frente, lado, frente, qRotaciona(qEixoAngulo(frente, rad), lado));
    assert.ok(Math.abs(2 * Math.atan2(q[0], q[3]) - rad) < 1e-6, `${graus} graus: veio ${(2 * Math.atan2(q[0], q[3]) * 180) / Math.PI}`);
    assert.ok(Math.abs(q[1]) < 1e-9 && Math.abs(q[2]) < 1e-9, 'o eixo é o do antebraço');
  }
  // Com a frente inclinada, a frente observada continua sendo a rotacionada do repouso e a torção vale em volta dela.
  const f2 = norm([1, 0.4, 0]), q0 = qComTorcao(frente, lado, f2, [0, 0, 1]);
  const lado0 = qRotaciona(q0, lado);
  const q = qComTorcao(frente, lado, f2, qRotaciona(qEixoAngulo(f2, 0.7), lado0));
  const r = qRotaciona(q, frente);
  assert.ok(Math.abs(r[0] - f2[0]) < 1e-6 && Math.abs(r[1] - f2[1]) < 1e-6, 'a frente fica no lugar');
  const extra = qMul(q, qConj(q0)); // o que sobrou além do alinhamento da frente: 0,7 rad em volta de f2
  assert.ok(Math.abs(qAngulo(extra) - 0.7) < 1e-6, `torção ${qAngulo(extra)}`);
});

test('retarget dos braços: o lado da palma gira o osso da mão; sem ele só a direção vale', () => {
  const lmCorpo = poseNorm();
  const lm = lmCorpo.map((p) => ({ x: (p.x - 0.5), y: (p.y - 0.5), z: 0, visibility: 1 }));
  // braço esquerdo da pessoa esticado para o lado: punho em x = +0.6 (sem espelho, a pessoa esquerda vai ao avatar esquerdo)
  lm[11] = { x: 0.2, y: 0, z: 0, visibility: 1 }; lm[13] = { x: 0.4, y: 0, z: 0, visibility: 1 }; lm[15] = { x: 0.6, y: 0, z: 0, visibility: 1 };
  lm[12] = { x: -0.2, y: 0, z: 0, visibility: 1 };
  const rep = { esq: { upperArm: [1, 0, 0], lowerArm: [1, 0, 0], hand: [1, 0, 0], handLado: [0, 0, 1] }, dir: { upperArm: [-1, 0, 0], lowerArm: [-1, 0, 0], hand: [-1, 0, 0], handLado: [0, 0, 1] } };
  const semLado = retargetBracos(lm, { espelho: false, repouso: rep, dirMaos: { esq: [1, 0, 0], dir: null, ladoEsq: null, ladoDir: null } });
  assert.ok(qAngulo(semLado.esq.hand) < 0.05, 'sem lado, nada de torção');
  // No quadro do avatar, z da imagem vira -z (EIXOS). Mão virada 90 graus em volta do antebraço: lado da imagem em y.
  const girada = retargetBracos(lm, { espelho: false, repouso: rep, dirMaos: { esq: [1, 0, 0], dir: null, ladoEsq: [0, -1, 0], ladoDir: null } });
  const ang = qAngulo(girada.esq.hand);
  assert.ok(Math.abs(ang - Math.PI / 2) < 0.05, `torção de 90 graus, veio ${ang}`);
});

test('dedos: tremor de lado não vira dobra e a zona morta zera a mão quase aberta', () => {
  const m = mao([0, 0, 0]);
  m[5] = { x: 0.09, y: 0, z: -0.04 }; m[17] = { x: 0.09, y: 0, z: 0.04 }; // lado da palma em z; a dobra é no plano x-y
  assert.ok(ladoDaMao(m)[2] > 0.99);
  const reto = flexaoDoDedo(m.map((p, i) => (DEDOS.Middle.includes(i) && i !== 9 ? { ...p, z: p.z + 0.004 * (i % 2 ? 1 : -1) } : p)), DEDOS.Middle);
  assert.ok(reto.prox < 0.02 && reto.inter < 0.02, 'oscilação lateral é descartada');
  const leve = retargetMao(mao([0.08, 0.08, 0.08]), 'dir');
  assert.ok(Object.values(leve).every((q) => qAngulo(q) < 0.02), '5 graus de dobra somem na zona morta');
  const media = retargetMao(mao([0.6, 0.6, 0.6]), 'dir');
  assert.ok(Math.abs(qAngulo(media.rightIndexProximal) - 0.6) < 0.03, 'dobra de verdade passa inteira');
});
