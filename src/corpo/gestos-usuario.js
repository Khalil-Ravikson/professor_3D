// Gestos do usuário que disparam clipes (prompt 7, V6). Não é captura de movimento: reconhece três gestos e avisa o app.
//   aceno     pulso oscilando acima do cotovelo        -> o personagem acena de volta
//   convite   mão levantada acima do ombro, parada     -> o personagem convida a pergunta
//   joinha    polegar para cima, outros dedos fechados -> o personagem comemora
// Exigem N quadros seguidos e têm intervalo mínimo entre disparos. Puro: recebe tempo e pontos, devolve a lista de gestos deste quadro.
// Pontos da pose (normalizados, y para baixo): 11 e 12 ombros, 13 e 14 cotovelos, 15 e 16 pulsos. Mão (mundo, y para baixo): 0 pulso, 2 base do
// polegar, 4 ponta do polegar, 6, 10, 14 e 18 segunda junta e 8, 12, 16 e 20 pontas dos outros dedos.
import { sub, len } from './matematica.js';

export const PADRAO_GESTOS = { janelaMs: 1200, quadrosJoinha: 5, maoLevantadaMs: 800, intervaloMs: { aceno: 8000, convite: 10000, joinha: 8000 } };

const P = (p) => [p.x, p.y, p.z];
const visivel = (p, v = 0.5) => p && (p.visibility ?? 1) >= v;

export function criarDetectorGestos(opc = {}) {
  const C = { ...PADRAO_GESTOS, ...opc, intervaloMs: { ...PADRAO_GESTOS.intervaloMs, ...(opc.intervaloMs || {}) } };
  const janela = { esq: [], dir: [] }; // amostras { t, x } do pulso, por lado da PESSOA
  const parada = { esq: null, dir: null }; // desde quando o pulso está acima do ombro
  const ultimo = { aceno: -Infinity, convite: -Infinity, joinha: -Infinity };
  let quadrosJoinha = 0;

  const podeDisparar = (nome, t) => t - ultimo[nome] >= C.intervaloMs[nome];

  function acenou(lado, norm, t) {
    const [ci, pi] = lado === 'esq' ? [13, 15] : [14, 16];
    const co = norm[ci], pu = norm[pi];
    const w = janela[lado];
    if (!visivel(co) || !visivel(pu) || pu.y > co.y - 0.02) { w.length = 0; return false; } // só vale com o pulso acima do cotovelo
    w.push({ t, x: pu.x });
    while (w.length && t - w[0].t > C.janelaMs) w.shift();
    if (w.length < 8) return false;
    let inversoes = 0, dir = 0, ant = w[0].x, caminho = 0, min = Infinity, max = -Infinity;
    for (const a of w) {
      const dx = a.x - ant;
      if (Math.abs(dx) > 0.012) { const d = Math.sign(dx); if (dir && d !== dir) inversoes++; dir = d; ant = a.x; caminho += Math.abs(dx); }
      min = Math.min(min, a.x); max = Math.max(max, a.x);
    }
    return inversoes >= 3 && caminho > 0.12 && max - min > 0.06;
  }

  function polegarParaCima(m) {
    if (!m || m.length < 21) return false;
    const subiu = m[4].y < m[2].y - 0.03; // y de mundo cresce para baixo: ponta do polegar bem acima da base
    const fechados = [[6, 8], [10, 12], [14, 16], [18, 20]].every(([pip, tip]) => len(sub(P(m[tip]), P(m[0]))) < len(sub(P(m[pip]), P(m[0]))));
    return subiu && fechados;
  }

  // quadro: { t (ms), norm (pose normalizada, 33), maos: { esq, dir } (mundo, 21) ou null }. Devolve ['aceno', ...].
  return {
    alimentar({ t, norm, maos = null }) {
      const eventos = [];
      if (!norm) { janela.esq.length = janela.dir.length = 0; parada.esq = parada.dir = null; quadrosJoinha = 0; return eventos; }
      let acenando = false;
      for (const lado of ['esq', 'dir']) if (acenou(lado, norm, t)) acenando = true;
      if (acenando && podeDisparar('aceno', t)) { ultimo.aceno = t; eventos.push('aceno'); janela.esq.length = janela.dir.length = 0; }
      // Mão levantada: pulso acima do ombro, sem balançar, por maoLevantadaMs.
      let levantada = false;
      for (const [lado, oi, pi] of [['esq', 11, 15], ['dir', 12, 16]]) {
        const om = norm[oi], pu = norm[pi];
        if (visivel(om) && visivel(pu) && pu.y < om.y - 0.04) { parada[lado] = parada[lado] ?? t; if (t - parada[lado] >= C.maoLevantadaMs) levantada = true; }
        else parada[lado] = null;
      }
      if (levantada && !acenando && podeDisparar('convite', t) && t - ultimo.aceno > 2000) { ultimo.convite = t; eventos.push('convite'); parada.esq = parada.dir = null; }
      // Joinha: precisa de N quadros seguidos.
      const joinha = maos && (polegarParaCima(maos.esq) || polegarParaCima(maos.dir));
      quadrosJoinha = joinha ? quadrosJoinha + 1 : 0;
      if (quadrosJoinha >= C.quadrosJoinha && podeDisparar('joinha', t)) { ultimo.joinha = t; quadrosJoinha = 0; eventos.push('joinha'); }
      return eventos;
    },
    zerar() { janela.esq.length = janela.dir.length = 0; parada.esq = parada.dir = null; quadrosJoinha = 0; },
  };
}
