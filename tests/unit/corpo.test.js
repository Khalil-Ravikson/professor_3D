import test from 'node:test';
import assert from 'node:assert/strict';
import { retargetCorpo, retargetTronco, retargetBracos, afastarDoPeito, REPOUSO, LIMITES, IDX } from '../../src/corpo/retarget.js';
import { qRotaciona, qAngulo, qEixoAngulo, QID, norm, len } from '../../src/corpo/matematica.js';
import { criarGanho, criarFiltroDePontos, suavizarOsso } from '../../src/corpo/suavizacao.js';
import { criarCalibracao } from '../../src/corpo/calibracao.js';
import { criarGravador, criarRepetidor, lerSessao, soNumeros, quadroDeNumeros } from '../../src/corpo/gravador.js';

// Pessoa de frente para a câmera, em metros, na convenção assumida do retarget: +x para a direita da IMAGEM (a ESQUERDA da pessoa),
// +y para BAIXO, +z para longe da câmera. Origem no meio do quadril.
function pessoa(over = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const set = (i, x, y, z = 0, v = 1) => { lm[i] = { x, y, z, visibility: v }; };
  set(IDX.ombroE, 0.2, -0.5); set(IDX.ombroD, -0.2, -0.5);
  set(IDX.quadrilE, 0.1, 0); set(IDX.quadrilD, -0.1, 0);
  // braços caídos
  set(IDX.cotoveloE, 0.2, -0.2); set(IDX.punhoE, 0.2, 0.05); set(IDX.indE, 0.2, 0.12); set(IDX.mindE, 0.18, 0.1);
  set(IDX.cotoveloD, -0.2, -0.2); set(IDX.punhoD, -0.2, 0.05); set(IDX.indD, -0.2, 0.12); set(IDX.mindD, -0.18, 0.1);
  for (const [i, v] of Object.entries(over)) lm[i] = { ...lm[i], ...v };
  return lm;
}
const perto = (a, b, tol = 0.02) => assert.ok(len([a[0] - b[0], a[1] - b[1], a[2] - b[2]]) < tol, `${a.map((x) => x.toFixed(3))} != ${b.map((x) => x.toFixed(3))}`);
const dirDo = (q, repouso) => qRotaciona(q, repouso);

test('braços caídos: a direção do braço aponta para baixo, no espelho e no modo direto', () => {
  for (const espelho of [true, false]) {
    const r = retargetBracos(pessoa(), { espelho });
    perto(norm(dirDo(r.esq.upperArm, REPOUSO.esq)), [0, -1, 0]);
    perto(norm(dirDo(r.dir.upperArm, REPOUSO.dir)), [0, -1, 0]);
  }
});
test('braço direito da pessoa levantado de lado (90 graus): espelho move o braço ESQUERDO do avatar, direto move o DIREITO', () => {
  // pessoa direita = lado -x da imagem; braço aberto para -x, na altura do ombro
  const lm = pessoa({ [IDX.cotoveloD]: { x: -0.5, y: -0.5 }, [IDX.punhoD]: { x: -0.8, y: -0.5 }, [IDX.indD]: { x: -0.9, y: -0.5 }, [IDX.mindD]: { x: -0.85, y: -0.52 } });
  const esp = retargetBracos(lm, { espelho: true });
  // no espelho o braço esquerdo do avatar (repouso +X) fica na posição de repouso: rotação ~ nula
  assert.ok(qAngulo(esp.esq.upperArm) < 0.05, `esq no espelho: ${qAngulo(esp.esq.upperArm)}`);
  assert.ok(qAngulo(esp.dir.upperArm) > 1.2); // o outro continua caído (90 graus longe do repouso)
  const dir = retargetBracos(lm, { espelho: false });
  assert.ok(qAngulo(dir.dir.upperArm) < 0.05, `dir no direto: ${qAngulo(dir.dir.upperArm)}`);
  assert.ok(qAngulo(dir.esq.upperArm) > 1.2);
});
test('braço à frente: a direção vai para o lado da câmera (+Z do avatar)', () => {
  // braço esquerdo da pessoa (+x) estendido para a câmera: z menor (mais perto)
  const lm = pessoa({ [IDX.cotoveloE]: { x: 0.2, y: -0.5, z: -0.3 }, [IDX.punhoE]: { x: 0.2, y: -0.5, z: -0.6 }, [IDX.indE]: { x: 0.2, y: -0.5, z: -0.7 }, [IDX.mindE]: { x: 0.18, y: -0.52, z: -0.68 } });
  const r = retargetBracos(lm, { espelho: false });
  perto(norm(dirDo(r.esq.upperArm, REPOUSO.esq)), [0, 0, 1], 0.03);
});
test('antebraço dobrado para cima: a rotação local do cotovelo existe e respeita o limite', () => {
  const lm = pessoa({ [IDX.cotoveloE]: { x: 0.25, y: -0.3 }, [IDX.punhoE]: { x: 0.25, y: -0.6 } }); // antebraço dobrado para cima (180 graus)
  const r = retargetBracos(lm, { espelho: false });
  assert.ok(qAngulo(r.esq.lowerArm) <= LIMITES.cotovelo + 1e-6, 'não dobra além do limite do cotovelo');
  assert.ok(qAngulo(r.esq.lowerArm) > 1.0);
});
test('punho não atravessa o peito: afastarDoPeito põe o ponto a pelo menos o raio do eixo do tronco', () => {
  const topo = [0, -0.5, 0], base = [0, 0, 0];
  const dentro = afastarDoPeito([0.01, -0.25, 0], [0.2, -0.3, 0], topo, base, LIMITES.raioPeito);
  assert.ok(Math.hypot(dentro[0], dentro[2]) >= LIMITES.raioPeito - 1e-6);
  const fora = [0.3, -0.25, 0];
  assert.deepEqual(afastarDoPeito(fora, [0.2, -0.3, 0], topo, base, LIMITES.raioPeito), fora); // fora do raio: não mexe
});
test('tronco: postura reta dá rotação nula; ombros girados 45 graus ficam limitados a cerca de 20 graus; calibração zera a base', () => {
  assert.ok(qAngulo(retargetTronco(pessoa()).total) < 0.02);
  const a = Math.PI / 4, c = Math.cos(a), s = Math.sin(a); // gira os ombros em volta do eixo vertical
  const lm = pessoa({ [IDX.ombroE]: { x: 0.2 * c, z: -0.2 * s }, [IDX.ombroD]: { x: -0.2 * c, z: 0.2 * s } });
  const t = retargetTronco(lm, { espelho: false });
  assert.ok(qAngulo(t.total) <= LIMITES.tronco + 1e-6);
  assert.ok(qAngulo(t.total) > LIMITES.tronco - 0.05, 'chegou no limite');
  assert.ok(qAngulo(t.spine) < qAngulo(t.total)); // dividido entre os três ossos
  const comBase = retargetTronco(lm, { espelho: false, base: retargetTronco(lm, { espelho: false }).bruto });
  assert.ok(qAngulo(comBase.total) < 0.02, 'com a base igual à postura, vira zero');
});
test('retargetCorpo devolve os ossos com a parte e a confiança de cada um', () => {
  const r = retargetCorpo(pessoa({ [IDX.punhoE]: { visibility: 0.2 } }));
  for (const nome of ['spine', 'chest', 'upperChest', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand']) assert.ok(r.ossos[nome], nome);
  assert.equal(r.ossos.spine.parte, 'tronco');
  assert.equal(r.ossos.leftUpperArm.parte, 'bracos');
  assert.ok(Math.min(r.ossos.leftUpperArm.confianca, r.ossos.rightUpperArm.confianca) <= 0.2);
  assert.ok(Math.max(r.ossos.leftUpperArm.confianca, r.ossos.rightUpperArm.confianca) > 0.9);
});

test('ganho: cai para 0 em 300 ms depois de N quadros ruins e volta com a mesma rampa', () => {
  const g = criarGanho({ limiar: 0.5, quadros: 4, rampaMs: 300 });
  for (let i = 0; i < 30; i++) g.atualizar(0.9, 1 / 30);
  assert.equal(g.valor, 1);
  for (let i = 0; i < 3; i++) g.atualizar(0.1, 1 / 30);
  assert.equal(g.valor, 1, 'três quadros ruins ainda não derrubam');
  let t = 0; while (g.valor > 0 && t < 2000) { g.atualizar(0.1, 1 / 30); t += 1000 / 30; }
  assert.ok(t <= 300 + 4 * (1000 / 30) + 40, `caiu em ${Math.round(t)} ms`);
  let sobe = 0; while (g.valor < 1 && sobe < 2000) { g.atualizar(0.9, 1 / 30); sobe += 1000 / 30; }
  assert.ok(sobe <= 300 + 3 * (1000 / 30) + 40, `voltou em ${Math.round(sobe)} ms`); // 3 quadros bons confirmam e a rampa leva 300 ms
});
test('filtro de pontos reduz tremor e osso suavizado respeita a velocidade angular', () => {
  const f = criarFiltroDePontos();
  const brutos = [], filtrados = [];
  for (let i = 0; i < 60; i++) {
    const ruido = (i % 2 ? 1 : -1) * 0.01;
    const lm = [{ x: ruido, y: 0, z: 0, visibility: 1 }];
    brutos.push(lm[0].x); filtrados.push(f.filtrar(lm, i / 30)[0].x);
  }
  const amp = (v) => Math.max(...v.slice(20)) - Math.min(...v.slice(20));
  assert.ok(amp(filtrados) < amp(brutos) * 0.6);
  const alvo = qEixoAngulo([0, 0, 1], 2); // 2 rad de uma vez
  const r = suavizarOsso(QID, alvo, 1 / 60, { velMax: 8, tau: 0.001 });
  assert.ok(qAngulo(r) <= (8 / 60) * 1.01, `andou ${qAngulo(r)} rad num quadro`);
});
test('calibração: termina com tempo e amostras mínimos, mostra o progresso e guarda a média', () => {
  const c = criarCalibracao({ duracaoMinMs: 1500, minAmostras: 6 });
  c.iniciar(0);
  const q = qEixoAngulo([0, 1, 0], 0.1);
  const amostra = { tronco: q, centro: [0.5, 0.5], escala: 0.3 };
  let r = c.alimentar(amostra, 100);
  assert.ok(r.fazendo && r.progresso > 0 && r.progresso < 1 && r.parado);
  for (let t = 200; t <= 1700; t += 100) r = c.alimentar(amostra, t);
  assert.ok(r.pronto && !r.fazendo && r.progresso === 1);
  assert.ok(Math.abs(qAngulo(c.base.tronco) - 0.1) < 1e-6);
  assert.ok(Math.abs(c.base.escala - 0.3) < 1e-9);
});
test('calibração só conta com a pessoa parada: mexer zera o progresso e o tempo recomeça', () => {
  const c = criarCalibracao({ duracaoMinMs: 1500, minAmostras: 6, limiteMovimentoRad: 0.12 });
  c.iniciar(0);
  const parado = { tronco: qEixoAngulo([0, 1, 0], 0.0), centro: [0.5, 0.5], escala: 0.3 };
  let r;
  for (let t = 0; t <= 1000; t += 100) r = c.alimentar(parado, t);
  assert.ok(r.progresso > 0.5);
  r = c.alimentar({ ...parado, tronco: qEixoAngulo([0, 1, 0], 0.5) }, 1100); // tranco de quase 30 graus
  assert.equal(r.parado, false);
  assert.equal(r.progresso, 0);
  // um mínimo de 1500 ms CONTADO DEPOIS do tranco
  for (let t = 1200; t <= 2500; t += 100) r = c.alimentar({ ...parado, tronco: qEixoAngulo([0, 1, 0], 0.5) }, t);
  assert.ok(!r.pronto || r.progresso === 1);
  for (let t = 2600; t <= 3000; t += 100) r = c.alimentar({ ...parado, tronco: qEixoAngulo([0, 1, 0], 0.5) }, t);
  assert.ok(r.pronto);
  assert.ok(Math.abs(qAngulo(c.base.tronco) - 0.5) < 0.02);
});
test('calibração ignora um tranco no meio da janela (média sem os 20% mais distantes) e falha com o corpo fora de quadro', () => {
  const c = criarCalibracao({ duracaoMinMs: 1500, minAmostras: 6, limiteMovimentoRad: 0.3 });
  c.iniciar(0);
  const base = { tronco: qEixoAngulo([0, 1, 0], 0.05), centro: [0.5, 0.5], escala: 0.3 };
  let r;
  for (let t = 0; t <= 1000; t += 100) r = c.alimentar(base, t);
  r = c.alimentar({ ...base, tronco: qEixoAngulo([0, 1, 0], 0.25) }, 1100); // dentro do limite, mas fora da média
  for (let t = 1200; t <= 1800; t += 100) r = c.alimentar(base, t);
  assert.ok(r.pronto);
  assert.ok(Math.abs(qAngulo(c.base.tronco) - 0.05) < 0.02, `base ${qAngulo(c.base.tronco)}`);
  const f = criarCalibracao({ duracaoMinMs: 1500, minAmostras: 6, duracaoMaxMs: 3000 });
  f.iniciar(0); f.alimentar(base, 100); f.alimentar(base, 200);
  assert.ok(f.alimentar(base, 4000).falhou);
});
test('calibração refina devagar para a postura de repouso e ignora gesto grande', () => {
  const c = criarCalibracao({ duracaoMinMs: 1500, minAmostras: 6 });
  c.iniciar(0);
  const a0 = { tronco: qEixoAngulo([0, 1, 0], 0.0), centro: [0.5, 0.5], escala: 0.3 };
  for (let t = 0; t <= 1700; t += 100) c.alimentar(a0, t);
  const alvo = { tronco: qEixoAngulo([0, 1, 0], 0.06), centro: [0.5, 0.5], escala: 0.3 };
  for (let i = 0; i < 1500; i++) c.refinar(alvo);
  assert.ok(Math.abs(qAngulo(c.base.tronco) - 0.06) < 0.01, 'a base chegou perto da postura nova');
  const antes = qAngulo(c.base.tronco);
  assert.equal(c.refinar({ ...alvo, tronco: qEixoAngulo([0, 1, 0], 0.9) }), false);
  assert.equal(qAngulo(c.base.tronco), antes, 'gesto grande não vira postura neutra');
});
test('gravador guarda só números, recusa o que não for número e o repetidor devolve os quadros no ritmo original', () => {
  const g = criarGravador({ maxQuadros: 3 });
  g.iniciar();
  for (let i = 0; i < 5; i++) g.adicionar(1000 + i * 33, pessoa());
  assert.equal(g.total, 3, 'respeita o limite');
  const quadros = lerSessao(g.serializar());
  assert.equal(quadros.length, 3);
  assert.ok(quadros.every(soNumeros));
  assert.throws(() => lerSessao(JSON.stringify({ formato: 'landmarks-numeros-v1', quadros: [{ t: 0, pose: [['a', 1, 2, 3]] }] })), /número/);
  const q = quadroDeNumeros(0, [{ x: 1, y: 2, z: 3, visibility: 0.5, imagem: 'x' }]);
  assert.deepEqual(Object.keys(q), ['t', 'pose']); // nenhum campo extra (imagem) passa para o arquivo
  assert.deepEqual(q.pose[0], [1, 2, 3, 0.5]);
  const agenda = [], vistos = [];
  const rep = criarRepetidor(quadros, (f) => vistos.push(f.t), { agendar: (fn, ms) => { agenda.push(ms); fn(); } });
  rep.iniciar();
  assert.deepEqual(vistos, quadros.map((x) => x.t));
  assert.deepEqual(agenda, [33, 33]);
});

import { repousoDoModelo, qParaLocal } from '../../src/corpo/retarget.js';
test('repouso lido do modelo: braço em A (caído 45 graus) e VRM 0.x com x e z invertidos', () => {
  const d = Math.SQRT1_2;
  // posições locais dos nós normalizados num modelo com braços em A (VRM 1.0): braço esquerdo desce para +X e -Y
  const pos1 = { leftLowerArm: [d * 0.3, -d * 0.3, 0], leftHand: [d * 0.25, -d * 0.25, 0], leftMiddleProximal: [0.08, -0.01, 0], rightLowerArm: [-d * 0.3, -d * 0.3, 0], rightHand: [-d * 0.25, -d * 0.25, 0], rightMiddleProximal: [-0.08, -0.01, 0] };
  const r1 = repousoDoModelo((n) => pos1[n] || null);
  perto(r1.esq.upperArm, [d, -d, 0]); perto(r1.dir.upperArm, [-d, -d, 0]);
  // o mesmo modelo como VRM 0.x: as posições locais vêm com x e z invertidos; a direção no quadro do avatar sai igual
  const pos0 = Object.fromEntries(Object.entries(pos1).map(([k, v]) => [k, [-v[0], v[1], -v[2]]]));
  const r0 = repousoDoModelo((n) => pos0[n] || null, { vrm0: true });
  perto(r0.esq.upperArm, r1.esq.upperArm); perto(r0.dir.hand, r1.dir.hand);
  // sem os nós, cai para o T-pose padrão
  perto(repousoDoModelo(() => null).esq.upperArm, [1, 0, 0]);
});
test('com braço em A, o braço caído da pessoa fecha 45 graus e o braço horizontal sobe 45 graus', () => {
  const d = Math.SQRT1_2;
  const rep = { esq: { upperArm: [d, -d, 0], lowerArm: [d, -d, 0], hand: [d, -d, 0] }, dir: { upperArm: [-d, -d, 0], lowerArm: [-d, -d, 0], hand: [-d, -d, 0] } };
  const lm = pessoa({ [IDX.cotoveloD]: { x: -0.5, y: -0.5 }, [IDX.punhoD]: { x: -0.8, y: -0.5 }, [IDX.indD]: { x: -0.9, y: -0.5 }, [IDX.mindD]: { x: -0.85, y: -0.52 } });
  const r = retargetBracos(lm, { espelho: false, repouso: rep });
  perto(norm(qRotaciona(r.dir.upperArm, rep.dir.upperArm)), [-1, 0, 0], 0.03); // chega na horizontal
  assert.ok(Math.abs(qAngulo(r.dir.upperArm) - Math.PI / 4) < 0.05, `gira ${(qAngulo(r.dir.upperArm) * 57.3).toFixed(0)} graus`);
  // a pessoa deixa o braço esquerdo reto para baixo: o modelo, em A, precisa fechar 45 graus para ficar vertical
  perto(norm(qRotaciona(r.esq.upperArm, rep.esq.upperArm)), [0, -1, 0], 0.03);
  assert.ok(Math.abs(qAngulo(r.esq.upperArm) - Math.PI / 4) < 0.05);
});
test('qParaLocal só troca o sinal de x e z no VRM 0.x', () => {
  assert.deepEqual(qParaLocal([0.1, 0.2, 0.3, 0.9], false), [0.1, 0.2, 0.3, 0.9]);
  assert.deepEqual(qParaLocal([0.1, 0.2, 0.3, 0.9], true), [-0.1, 0.2, -0.3, 0.9]);
});

test('webcam de mesa: sem quadril visível o tronco não inclina (só a guinada dos ombros) e a confiança vem dos ombros', () => {
  const lm = pessoa({ [IDX.quadrilE]: { x: 0.5, y: 0.9, visibility: 0.1 }, [IDX.quadrilD]: { x: -0.7, y: 0.8, visibility: 0.1 } });
  const t = retargetTronco(lm, { espelho: false });
  assert.ok(qAngulo(t.total) < 0.02, 'quadril chutado não pode entortar o tronco');
  assert.ok(t.confianca > 0.9);
  assert.equal(t.quadrilVisivel, false);
});
test('cada braço tem a sua confiança: mão fora de quadro derruba só aquele braço', () => {
  const lm = pessoa({ [IDX.punhoE]: { visibility: 0.1 }, [IDX.cotoveloE]: { visibility: 0.2 } });
  const r = retargetCorpo(lm, { espelho: false });
  assert.ok(r.ossos.leftUpperArm.confianca <= 0.2);
  assert.ok(r.ossos.rightUpperArm.confianca > 0.9);
});
