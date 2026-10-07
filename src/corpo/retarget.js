// Retarget do corpo (prompt 7, V5): pontos de mundo do MediaPipe -> rotações dos ossos humanoides NORMALIZADOS do VRM.
// Por DIREÇÃO, não por posição: para cada segmento, a rotação que leva a direção de repouso do osso (T-pose do VRM 1.0 normalizado:
// braço esquerdo para +X, direito para -X) até a direção observada. O tamanho dos braços do modelo não importa e não há IK.
//
// Convenção de ENTRADA assumida (NÃO confirmada na documentação oficial, que só diz "metros, origem no meio do quadril"):
//   +x para a direita da IMAGEM, +y para BAIXO, +z para longe da câmera (menor = mais perto). Está em um só lugar (EIXOS) para
//   ser trocado sem reescrever nada; a lateralidade e a profundidade precisam ser conferidas com a webcam (TESTES-MANUAIS.md).
// Convenção de SAÍDA: o avatar de frente para quem olha: +X é a esquerda do avatar (direita da tela), +Y para cima, +Z para a câmera.
//
// Índices do Pose Landmarker (documentação oficial, 07/10/2026): 11 e 12 ombros esquerdo e direito, 13 e 14 cotovelos, 15 e 16 punhos,
// 17 e 18 mindinhos, 19 e 20 indicadores, 21 e 22 polegares, 23 e 24 quadris. Esquerdo e direito são os da PESSOA.
import { sub, add, mul, norm, len, dot, meio, QID, qMul, qConj, qDeParaDirecao, qRotaciona, qLimitar, qSlerp } from './matematica.js';

export const IDX = { ombroE: 11, ombroD: 12, cotoveloE: 13, cotoveloD: 14, punhoE: 15, punhoD: 16, mindE: 17, mindD: 18, indE: 19, indD: 20, quadrilE: 23, quadrilD: 24 };
export const EIXOS = { x: 1, y: -1, z: -1 }; // pontos do MediaPipe -> quadro do avatar (sinais por eixo)
export const REPOUSO = { esq: [1, 0, 0], dir: [-1, 0, 0] }; // padrão: T-pose do VRM 1.0 (a direção REAL vem de repousoDoModelo)

// Direção de repouso de cada segmento no QUADRO DO AVATAR (+X esquerda do avatar, +Y cima, +Z para a câmera). O osso normalizado do VRM tem rotação
// identidade, mas o braço pode estar em A (caído) e, no VRM 0.x, o quadro local é girado 180 graus em Y (x e z invertidos). Por isso a direção
// vem do próprio modelo: posição local do osso filho no pai, convertida para o quadro do avatar.
export function repousoDoModelo(posicao, { vrm0 = false } = {}) {
  // posicao(nome) -> [x, y, z] local do nó normalizado, ou null
  const conv = (v) => (v ? norm(vrm0 ? [-v[0], v[1], -v[2]] : v) : null);
  const filhoMao = (lado) => { for (const d of ['middleProximal', 'ringProximal', 'indexProximal', 'littleProximal']) { const v = posicao(lado + d[0].toUpperCase() + d.slice(1)); if (v) return v; } return null; };
  const lado = (l, padrao) => ({
    upperArm: conv(posicao(l + 'LowerArm')) || padrao,
    lowerArm: conv(posicao(l + 'Hand')) || padrao,
    hand: conv(filhoMao(l)) || padrao,
  });
  return { esq: lado('left', REPOUSO.esq), dir: lado('right', REPOUSO.dir) };
}
// A rotação calculada no quadro do avatar vira rotação LOCAL do osso: no VRM 0.x troca o sinal de x e z.
export const qParaLocal = (q, vrm0) => (vrm0 ? [-q[0], q[1], -q[2], q[3]] : q);


export const LIMITES = {
  tronco: (20 * Math.PI) / 180, // guinada, inclinação e rotação juntas, até cerca de 20 graus (prompt)
  cotovelo: (150 * Math.PI) / 180, // dobra máxima do antebraço em relação ao braço
  ombro: (170 * Math.PI) / 180,
  encolher: 0.05, // metros que o ombro sobe, no máximo (não usado como posição: vira rotação pequena)
  raioPeito: 0.1, // metros: distância mínima do punho ao eixo do tronco
};

const ponto = (lm, i, eixos, espelho) => [(espelho ? -1 : 1) * eixos.x * lm[i].x, eixos.y * lm[i].y, eixos.z * lm[i].z];
const vis = (lm, i) => (lm[i] && Number.isFinite(lm[i].visibility) ? lm[i].visibility : 1);

// Distância mínima do punho ao eixo do tronco (ombros e quadris no mesmo quadro): impede o braço de atravessar o peito.
export function afastarDoPeito(punho, cotovelo, topo, base, raio) {
  const eixo = sub(topo, base), l2 = dot(eixo, eixo) || 1;
  const t = Math.max(0, Math.min(1, dot(sub(punho, base), eixo) / l2));
  const mais = add(base, mul(eixo, t));
  const d = sub(punho, mais), dist = len(d);
  if (dist >= raio) return punho;
  const fora = dist < 1e-6 ? [0, 0, 1] : mul(d, 1 / dist);
  return add(mais, mul(fora, raio));
}

// Tronco: inclinação do eixo quadril->ombros e guinada da linha dos ombros, limitadas e divididas em três ossos.
export function retargetTronco(lm, { eixos = EIXOS, espelho = true, base = null } = {}) {
  const oE = ponto(lm, IDX.ombroE, eixos, espelho), oD = ponto(lm, IDX.ombroD, eixos, espelho);
  const qE = ponto(lm, IDX.quadrilE, eixos, espelho), qD = ponto(lm, IDX.quadrilD, eixos, espelho);
  // No espelho a pessoa direita vira o lado esquerdo do avatar: troca os papéis para a linha dos ombros apontar para +X.
  const ombroEsqAv = espelho ? oD : oE, ombroDirAv = espelho ? oE : oD;
  const eixoTronco = norm(sub(meio(oE, oD), meio(qE, qD)));
  const inclina = qDeParaDirecao([0, 1, 0], eixoTronco);
  const linha = qRotaciona(qConj(inclina), sub(ombroEsqAv, ombroDirAv));
  const guinada = qDeParaDirecao([1, 0, 0], norm([linha[0], 0, linha[2]]));
  const bruto = qMul(inclina, guinada); // antes da base e do limite: é o que a calibração guarda
  let total = base ? qMul(qConj(base), bruto) : bruto; // calibração: o que ficou parado na pose neutra vira zero
  total = qLimitar(total, LIMITES.tronco);
  const terco = qSlerp(QID, total, 1 / 3);
  return { total, bruto, spine: terco, chest: terco, upperChest: terco, confianca: Math.min(vis(lm, IDX.ombroE), vis(lm, IDX.ombroD), vis(lm, IDX.quadrilE), vis(lm, IDX.quadrilD)) };
}

// Braços e mãos (punho): rotações LOCAIS de upperArm, lowerArm e hand, dadas as do tronco (para descontar a inclinação do peito).
export function retargetBracos(lm, { eixos = EIXOS, espelho = true, tronco = null, repouso = null } = {}) {
  const rep = repouso || { esq: { upperArm: REPOUSO.esq, lowerArm: REPOUSO.esq, hand: REPOUSO.esq }, dir: { upperArm: REPOUSO.dir, lowerArm: REPOUSO.dir, hand: REPOUSO.dir } };
  const oE = ponto(lm, IDX.ombroE, eixos, espelho), oD = ponto(lm, IDX.ombroD, eixos, espelho);
  const qE = ponto(lm, IDX.quadrilE, eixos, espelho), qD = ponto(lm, IDX.quadrilD, eixos, espelho);
  const topo = meio(oE, oD), base = meio(qE, qD);
  const chestMundo = tronco ? tronco.total : QID;
  const lado = (rotulo, ombro, cotovelo, punho, dedoI, dedoM, rp) => {
    let pPunho = punho;
    pPunho = afastarDoPeito(pPunho, cotovelo, topo, base, LIMITES.raioPeito);
    const dirBraco = norm(sub(cotovelo, ombro)), dirAntebraco = norm(sub(pPunho, cotovelo));
    const qBracoMundo = qLimitar(qDeParaDirecao(rp.upperArm, dirBraco), LIMITES.ombro);
    const qAnteMundo = qDeParaDirecao(rp.lowerArm, dirAntebraco);
    const bracoLocal = qMul(qConj(chestMundo), qBracoMundo);
    const anteLocal = qLimitar(qMul(qConj(qBracoMundo), qAnteMundo), LIMITES.cotovelo);
    // Mão: direção do punho para o meio entre indicador e mindinho (a palma); só inclina o punho, pouco.
    const dirMao = norm(sub(meio(dedoI, dedoM), pPunho));
    const maoLocal = qLimitar(qMul(qConj(qAnteMundo), qDeParaDirecao(rp.hand, dirMao)), (60 * Math.PI) / 180);
    return { upperArm: bracoLocal, lowerArm: anteLocal, hand: maoLocal, dirBraco, dirAntebraco, confianca: rotulo };
  };
  // Ombro/cotovelo/punho da PESSOA; no espelho o lado direito da pessoa comanda o esquerdo do avatar.
  const pessoa = {
    E: { ombro: oE, cotovelo: ponto(lm, IDX.cotoveloE, eixos, espelho), punho: ponto(lm, IDX.punhoE, eixos, espelho), i: ponto(lm, IDX.indE, eixos, espelho), m: ponto(lm, IDX.mindE, eixos, espelho), v: Math.min(vis(lm, IDX.ombroE), vis(lm, IDX.cotoveloE), vis(lm, IDX.punhoE)) },
    D: { ombro: oD, cotovelo: ponto(lm, IDX.cotoveloD, eixos, espelho), punho: ponto(lm, IDX.punhoD, eixos, espelho), i: ponto(lm, IDX.indD, eixos, espelho), m: ponto(lm, IDX.mindD, eixos, espelho), v: Math.min(vis(lm, IDX.ombroD), vis(lm, IDX.cotoveloD), vis(lm, IDX.punhoD)) },
  };
  const paraEsq = espelho ? pessoa.D : pessoa.E, paraDir = espelho ? pessoa.E : pessoa.D;
  const esq = lado(paraEsq.v, paraEsq.ombro, paraEsq.cotovelo, paraEsq.punho, paraEsq.i, paraEsq.m, rep.esq);
  const dir = lado(paraDir.v, paraDir.ombro, paraDir.cotovelo, paraDir.punho, paraDir.i, paraDir.m, rep.dir);
  return { esq: { ...esq, confianca: paraEsq.v }, dir: { ...dir, confianca: paraDir.v } };
}

// Nomes dos ossos humanoides do VRM para cada resultado.
export const OSSOS = {
  esq: { upperArm: 'leftUpperArm', lowerArm: 'leftLowerArm', hand: 'leftHand' },
  dir: { upperArm: 'rightUpperArm', lowerArm: 'rightLowerArm', hand: 'rightHand' },
  tronco: { spine: 'spine', chest: 'chest', upperChest: 'upperChest' },
};

// Todos os ossos num só mapa { nomeDoOsso: { q, confianca, parte } }, para o adaptador aplicar com o peso de cada parte.
export function retargetCorpo(lm, opcoes = {}) {
  const tronco = retargetTronco(lm, opcoes);
  const br = retargetBracos(lm, { ...opcoes, tronco });
  const ossos = {};
  for (const k of Object.keys(OSSOS.tronco)) ossos[OSSOS.tronco[k]] = { q: tronco[k], confianca: tronco.confianca, parte: 'tronco' };
  for (const lado of ['esq', 'dir']) for (const k of ['upperArm', 'lowerArm']) ossos[OSSOS[lado][k]] = { q: br[lado][k], confianca: br[lado].confianca, parte: 'bracos' };
  for (const lado of ['esq', 'dir']) ossos[OSSOS[lado].hand] = { q: br[lado].hand, confianca: br[lado].confianca, parte: 'bracos' };
  return { ossos, tronco, bracos: br };
}
