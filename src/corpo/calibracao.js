// Calibração (prompt 7, V5): "fique em pose neutra por 2 segundos". Guarda a média da inclinação do tronco e do centro do corpo,
// para que o que sobrar de torto na postura natural vire zero. Puro: recebe amostras, devolve a base.
import { qNorm, QID } from './matematica.js';

function mediaQuat(qs) {
  if (!qs.length) return QID;
  const ref = qs[0];
  let s = [0, 0, 0, 0];
  for (const q of qs) {
    const sinal = ref[0] * q[0] + ref[1] * q[1] + ref[2] * q[2] + ref[3] * q[3] < 0 ? -1 : 1; // mesmo hemisfério
    s = [s[0] + sinal * q[0], s[1] + sinal * q[1], s[2] + sinal * q[2], s[3] + sinal * q[3]];
  }
  return qNorm(s);
}

export function criarCalibracao({ duracaoMs = 2000, minAmostras = 8 } = {}) {
  let ativo = false, t0 = 0, amostras = [], base = null;
  return {
    iniciar(tMs) { ativo = true; t0 = tMs; amostras = []; },
    cancelar() { ativo = false; amostras = []; },
    // amostra: { tronco: [x,y,z,w], centro: [x,y], escala }  (centro e escala vêm da posição e da largura dos ombros na imagem)
    alimentar(amostra, tMs) {
      if (!ativo) return { fazendo: false, progresso: base ? 1 : 0, pronto: !!base };
      amostras.push(amostra);
      const progresso = Math.min(1, (tMs - t0) / duracaoMs);
      if (progresso >= 1) {
        ativo = false;
        if (amostras.length < minAmostras) { amostras = []; return { fazendo: false, progresso: 0, pronto: !!base, falhou: 'poucas amostras: o corpo ficou fora de quadro' }; }
        const n = amostras.length;
        base = {
          tronco: mediaQuat(amostras.map((a) => a.tronco)),
          centro: [amostras.reduce((s, a) => s + a.centro[0], 0) / n, amostras.reduce((s, a) => s + a.centro[1], 0) / n],
          escala: amostras.reduce((s, a) => s + a.escala, 0) / n,
        };
        amostras = [];
        return { fazendo: false, progresso: 1, pronto: true, base };
      }
      return { fazendo: true, progresso, pronto: !!base };
    },
    get base() { return base; },
    get fazendo() { return ativo; },
    zerar() { ativo = false; base = null; amostras = []; },
  };
}
