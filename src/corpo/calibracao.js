// Calibração (prompt 7, V5, refeita em 08/10/2026): "fique em pose neutra". Guarda a inclinação do tronco e o centro e a escala do corpo na imagem,
// para que a postura natural vire zero. Mudanças para ficar fluida:
//  - só conta amostra quando a pessoa está PARADA: se o tronco se mexe mais de `limiteMovimentoRad` em relação à média da janela, a janela recomeça
//    (o app mostra "fique parado" em vez de calibrar torto);
//  - termina por tempo mínimo (1,5 s) E número mínimo de amostras (6), com progresso de 0 a 1 para a interface;
//  - a base final é a média das amostras SEM as 20% mais distantes (robusta a um tranco);
//  - depois de pronta, `refinar` desliza a base devagar para a postura de repouso atual (a postura natural muda com o cansaço).
// Puro: recebe amostras e devolve a base.
import { qNorm, qMul, qConj, qAngulo, qSlerp, QID } from './matematica.js';

function mediaQuat(qs, pesos = null) {
  if (!qs.length) return QID;
  const ref = qs[0];
  let s = [0, 0, 0, 0];
  qs.forEach((q, i) => {
    const w = pesos ? pesos[i] : 1;
    const sinal = ref[0] * q[0] + ref[1] * q[1] + ref[2] * q[2] + ref[3] * q[3] < 0 ? -1 : 1; // mesmo hemisfério
    s = [s[0] + w * sinal * q[0], s[1] + w * sinal * q[1], s[2] + w * sinal * q[2], s[3] + w * sinal * q[3]];
  });
  return qNorm(s);
}
const dist = (a, b) => qAngulo(qMul(qConj(a), b));

export function criarCalibracao({ duracaoMinMs = 1500, duracaoMaxMs = 6000, minAmostras = 6, limiteMovimentoRad = 0.12 } = {}) {
  let ativo = false, t0 = 0, amostras = [], base = null, parado = true;
  const mediaAtual = () => mediaQuat(amostras.map((a) => a.tronco));
  return {
    iniciar(tMs) { ativo = true; t0 = tMs; amostras = []; parado = true; },
    cancelar() { ativo = false; amostras = []; },
    // amostra: { tronco: [x,y,z,w], centro: [x,y], escala }. Devolve { fazendo, progresso (0 a 1), parado, pronto, base?, falhou? }.
    alimentar(amostra, tMs) {
      if (!ativo) return { fazendo: false, progresso: base ? 1 : 0, parado: true, pronto: !!base };
      if (amostras.length >= 3 && dist(mediaAtual(), amostra.tronco) > limiteMovimentoRad) {
        // Mexeu: a janela recomeça com esta amostra. O relógio também, para o tempo mínimo valer só com a pessoa parada.
        amostras = [amostra]; t0 = tMs; parado = false;
        return { fazendo: true, progresso: 0, parado: false, pronto: !!base };
      }
      amostras.push(amostra); parado = true;
      const porTempo = (tMs - t0) / duracaoMinMs, porAmostras = amostras.length / minAmostras;
      const progresso = Math.max(0, Math.min(1, Math.min(porTempo, porAmostras)));
      if (progresso >= 1) {
        ativo = false;
        const media = mediaAtual();
        // Descarta as 20% mais distantes da média e refaz a média.
        const ordem = amostras.map((a, i) => ({ i, d: dist(media, a.tronco) })).sort((x, y) => x.d - y.d);
        const bons = ordem.slice(0, Math.max(minAmostras - 1, Math.ceil(ordem.length * 0.8))).map((o) => amostras[o.i]);
        const n = bons.length;
        base = {
          tronco: mediaQuat(bons.map((a) => a.tronco)),
          centro: [bons.reduce((s, a) => s + a.centro[0], 0) / n, bons.reduce((s, a) => s + a.centro[1], 0) / n],
          escala: bons.reduce((s, a) => s + a.escala, 0) / n,
        };
        amostras = [];
        return { fazendo: false, progresso: 1, parado: true, pronto: true, base };
      }
      if (tMs - t0 > duracaoMaxMs && amostras.length < minAmostras) {
        ativo = false; amostras = [];
        return { fazendo: false, progresso: 0, parado: true, pronto: !!base, falhou: 'poucas amostras: o corpo ficou fora de quadro' };
      }
      return { fazendo: true, progresso, parado, pronto: !!base };
    },
    // Desliza a base devagar para a postura de repouso atual. `k` é a fração por chamada (0,002 por quadro a 24 por segundo dá cerca de 20 s).
    // Só age com a postura perto da base (desvio menor que `ate`): um gesto grande não vira "nova postura neutra".
    refinar(amostra, k = 0.002, ate = 0.1) {
      if (!base || dist(base.tronco, amostra.tronco) > ate) return false;
      base.tronco = qSlerp(base.tronco, amostra.tronco, k);
      if (amostra.escala > 0) {
        base.centro = [base.centro[0] + (amostra.centro[0] - base.centro[0]) * k, base.centro[1] + (amostra.centro[1] - base.centro[1]) * k];
        base.escala += (amostra.escala - base.escala) * k;
      }
      return true;
    },
    get base() { return base; },
    get fazendo() { return ativo; },
    get parado() { return parado; },
    zerar() { ativo = false; base = null; amostras = []; parado = true; },
  };
}
