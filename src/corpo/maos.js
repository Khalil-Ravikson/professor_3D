// Mãos e dedos (prompt 7, V6). Pontos do Hand Landmarker (21 por mão, coordenadas de mundo em metros, origem no centro da mão):
// 0 pulso; 1 a 4 polegar; 5 a 8 indicador; 9 a 12 médio; 13 a 16 anelar; 17 a 20 mindinho (estrutura conferida nas conexões HAND_CONNECTIONS do
// vision_bundle.mjs oficial em 07/10/2026; a documentação em texto não traz a tabela).
// Flexão de cada junta = ângulo entre segmentos consecutivos. A rotação entra em volta do eixo Z local do osso (os dedos do VRM dobram em Z:
// esquerda com sinal negativo, direita com positivo, no quadro do avatar); no VRM 0.x o chamador converte com qParaLocal.
// O POLEGAR tem tratamento próprio e APROXIMADO: dobra em Z como os outros, com ganhos menores. NÃO foi validado com uma mão real.
import { sub, dot, mul, norm, len, angulo, qEixoAngulo, qLimitar, QID } from './matematica.js';

export const DEDOS = { Index: [5, 6, 7, 8], Middle: [9, 10, 11, 12], Ring: [13, 14, 15, 16], Little: [17, 18, 19, 20] };
const P = (p) => [p.x, p.y, p.z]; // landmark { x, y, z } -> vetor
const MAX = { prox: 1.57, inter: 1.9, dist: 1.4 }; // dobra máxima em radianos (90, 109 e 80 graus)

// Os segmentos são projetados no plano em que o dedo dobra (tira a componente lateral, do indicador para o mindinho): o tremor de lado e a
// abertura entre os dedos não viram "dobra", e o ângulo de um dedo esticado perde o viés positivo do acos sobre ruído.
export function flexaoDoDedo(lm, [mcp, pip, dip, tip]) {
  const lado = ladoDaMao(lm);
  const plano = (v) => (lado ? sub(v, mul(lado, dot(v, lado))) : v);
  const palma = plano(sub(P(lm[mcp]), P(lm[0])));
  const s1 = plano(sub(P(lm[pip]), P(lm[mcp]))), s2 = plano(sub(P(lm[dip]), P(lm[pip]))), s3 = plano(sub(P(lm[tip]), P(lm[dip])));
  return { prox: Math.min(angulo(palma, s1), MAX.prox), inter: Math.min(angulo(s1, s2), MAX.inter), dist: Math.min(angulo(s2, s3), MAX.dist) };
}

// Zona morta macia: abaixo de ZONA a dobra some, de 2*ZONA para cima passa inteira, no meio sobe suave. Um dedo esticado sempre lê alguns graus
// de dobra por causa do ruído; sem isto a mão aberta tremia e os dedos "respiravam".
const ZONA = 0.1; // radianos (cerca de 6 graus)
function macia(x) { const t = Math.max(0, Math.min(1, (x - ZONA) / ZONA)); return x * t * t * (3 - 2 * t); }
// Direção do indicador (5) para o mindinho (17), unitária, ou null. Define o lado da palma; junto com pulso -> dedo médio dá a orientação da mão.
export function ladoDaMao(lm) {
  if (!lm || lm.length < 21) return null;
  const v = sub(P(lm[17]), P(lm[5]));
  return len(v) > 0.02 ? norm(v) : null; // mão real: cerca de 6 a 8 cm entre o indicador e o mindinho; menos que 2 cm é ruído ou mão de lado demais
}

// lm: 21 pontos [{x,y,z}] da mão. ladoAvatar: 'esq' | 'dir' (qual mão do avatar recebe). Devolve { nomeDoOsso: quaternion } no quadro do avatar.
export function retargetMao(lm, ladoAvatar) {
  const prefixo = ladoAvatar === 'esq' ? 'left' : 'right';
  const sinal = ladoAvatar === 'esq' ? -1 : 1;
  const curva = (rad) => qEixoAngulo([0, 0, 1], sinal * rad);
  const ossos = {};
  for (const [nome, idx] of Object.entries(DEDOS)) {
    const f = flexaoDoDedo(lm, idx);
    const prox = macia(f.prox), inter = macia(f.inter);
    // A junta da ponta dobra junto com a do meio (acoplamento natural do dedo, cerca de 2/3): mistura o medido com isso, que é bem mais estável.
    const dist = Math.min(macia(f.dist) * 0.6 + inter * 0.66 * 0.4, MAX.dist);
    ossos[`${prefixo}${nome}Proximal`] = curva(prox);
    ossos[`${prefixo}${nome}Intermediate`] = curva(inter);
    ossos[`${prefixo}${nome}Distal`] = curva(dist);
  }
  // Polegar (aproximado): metacarpo, proximal e distal a partir dos segmentos 0-1-2-3-4.
  const d = (a, b) => sub(P(lm[b]), P(lm[a]));
  const t = { meta: angulo(d(0, 1), d(1, 2)), prox: angulo(d(1, 2), d(2, 3)), dist: angulo(d(2, 3), d(3, 4)) };
  ossos[`${prefixo}ThumbMetacarpal`] = curva(macia(Math.min(t.meta, 0.6)) * 0.5);
  ossos[`${prefixo}ThumbProximal`] = curva(macia(Math.min(t.prox, 1.0)));
  ossos[`${prefixo}ThumbDistal`] = curva(macia(Math.min(t.dist, 1.2)));
  return ossos;
}

// Cada mão detectada vai para o pulso da pose mais próximo (coordenadas normalizadas). Não confia no rótulo "Left" ou "Right": a
// documentação diz que ele assume imagem espelhada, e o vídeo da webcam aqui não é espelhado.
// maos: [{ mundo: [21], norm: [21] }]; poseNorm: 33 pontos normalizados. Devolve { esq, dir } da PESSOA (15 = pulso esquerdo, 16 = direito).
// Para a mão não trocar de lado de um quadro para o outro (o que parecia "bug" e "trava"):
//  - `anterior` guarda onde estava o pulso de cada lado no quadro anterior; uma mão que continua perto dele fica no mesmo lado (preferência forte);
//  - se o pulso da pose some (pouco visível, comum com a mão perto da câmera), vale o rótulo do modelo, TROCADO: o rótulo assume imagem
//    espelhada e o vídeo daqui não é, então "Left" é a mão direita da pessoa.
// Devolve { esq, dir, pulsos: { esq, dir } }; `pulsos` é o que vai em `anterior` na chamada seguinte.
export function emparelharMaos(maos, poseNorm, { distMax = 0.3, anterior = null } = {}) {
  const r = { esq: null, dir: null, pulsos: { esq: null, dir: null } };
  if (!maos || !maos.length || !poseNorm) return r;
  const pulsos = { esq: poseNorm[15], dir: poseNorm[16] };
  const visivel = (p) => p && (p.visibility ?? 1) > 0.3;
  const pares = [];
  maos.forEach((m, i) => {
    const w = m.norm && m.norm[0];
    if (!w) return;
    for (const lado of ['esq', 'dir']) {
      const p = pulsos[lado];
      let custo = visivel(p) ? Math.hypot(p.x - w.x, p.y - w.y) : Infinity;
      const a = anterior && anterior[lado];
      if (a && Math.hypot(a.x - w.x, a.y - w.y) < 0.12) custo = Math.min(custo, 0.01); // continuidade manda: a mão que segue perto de onde estava fica no lado dela
      if (Number.isFinite(custo)) pares.push({ i, lado, d: custo });
    }
  });
  pares.sort((a, b) => a.d - b.d);
  const usadas = new Set();
  const atribuir = (i, lado) => { r[lado] = maos[i].mundo; r.pulsos[lado] = { x: maos[i].norm[0].x, y: maos[i].norm[0].y }; usadas.add(i); };
  for (const p of pares) {
    if (p.d > distMax || usadas.has(p.i) || r[p.lado]) continue;
    atribuir(p.i, p.lado);
  }
  // Sobrou mão sem pulso visível para casar: usa o rótulo trocado.
  maos.forEach((m, i) => {
    if (usadas.has(i) || !m.norm || !m.norm[0]) return;
    const lado = m.rotulo === 'Left' ? 'dir' : m.rotulo === 'Right' ? 'esq' : null;
    if (lado && !r[lado] && !visivel(pulsos[lado])) atribuir(i, lado);
  });
  return r;
}

// Direção do pulso para a base do dedo médio, no quadro de mundo da mão (vetor [x, y, z]). Dá a orientação do osso da mão a partir dos pontos
// da PRÓPRIA mão, que são bem mais estáveis do que os pontos 17 a 20 da pose.
export function dirDaMao(lm) {
  if (!lm || lm.length < 21) return null;
  const v = [lm[9].x - lm[0].x, lm[9].y - lm[0].y, lm[9].z - lm[0].z];
  return Math.hypot(v[0], v[1], v[2]) > 1e-4 ? v : null;
}
