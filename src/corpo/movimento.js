// Movimento do corpo (prompt 7, V6): deslocamento lateral e de profundidade do quadril do avatar, a partir da posição e da escala dos ombros
// na imagem, com zona morta, limites curtos (cerca de 30 cm para os lados e 20 cm em profundidade) e retorno suave ao centro.
// Puro: recebe pontos NORMALIZADOS da pose (11 e 12 são os ombros) e devolve metros no quadro do avatar (+X esquerda do avatar, +Z para a câmera).
import { QID } from './matematica.js';

export const LIMITES_MOV = { lateral: 0.30, profundidade: 0.20, zonaMorta: 0.03, ombroRealM: 0.40, tau: 0.25 };

// Centro e escala do corpo na imagem: usados pela calibração e por calcular().
export function medidaDoCorpo(norm) {
  const e = norm[11], d = norm[12];
  if (!e || !d) return null;
  const vis = Math.min(e.visibility ?? 1, d.visibility ?? 1);
  return { centro: [(e.x + d.x) / 2, (e.y + d.y) / 2], escala: Math.hypot(e.x - d.x, e.y - d.y), vis };
}

const zonaMorta = (v, z) => (Math.abs(v) <= z ? 0 : v - Math.sign(v) * z);
const limitar = (v, m) => Math.max(-m, Math.min(m, v));

export function criarMovimento(opc = {}) {
  const L = { ...LIMITES_MOV, ...opc };
  let x = 0, z = 0;
  return {
    // base: { centro, escala } da calibração. espelho: no espelho o que a imagem mostra à esquerda vai para a direita do avatar.
    calcular(norm, base, espelho, dtSeg) {
      const m = norm ? medidaDoCorpo(norm) : null;
      let alvoX = 0, alvoZ = 0;
      if (m && base && m.escala > 0.02 && base.escala > 0.02) {
        const metrosPorUnidade = L.ombroRealM / base.escala; // a largura real dos ombros (cerca de 40 cm) dá a escala da imagem
        const dx = (m.centro[0] - base.centro[0]) * metrosPorUnidade;
        alvoX = limitar(zonaMorta((espelho ? -1 : 1) * dx, L.zonaMorta), L.lateral);
        // Ombros maiores na imagem = pessoa mais perto da câmera = avatar um pouco para a frente.
        const prof = (m.escala / base.escala - 1) * 0.5;
        alvoZ = limitar(zonaMorta(prof, L.zonaMorta), L.profundidade);
      }
      const k = 1 - Math.exp(-dtSeg / L.tau); // sem pessoa ou dentro da zona morta, o alvo é 0: volta ao centro com suavidade
      x += (alvoX - x) * k; z += (alvoZ - z) * k;
      return { x, z };
    },
    zerar() { x = 0; z = 0; },
  };
}
