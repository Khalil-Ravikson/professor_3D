// Suavização e confiança do rastreamento (prompt 7, V5). Puro, testável.
import { FiltroOneEuro } from '../filtro-one-euro.js';
import { qAndar, qSlerp } from './matematica.js';

// Filtro por ponto (x, y, z de cada landmark). Parâmetros em configuração: minCutoff menor = mais liso e mais atrasado.
export function criarFiltroDePontos({ minCutoff = 1.2, beta = 0.05, dCutoff = 1.0 } = {}) {
  const filtros = new Map();
  const f = (i, eixo) => { const k = `${i}${eixo}`; if (!filtros.has(k)) filtros.set(k, new FiltroOneEuro({ minCutoff, beta, dCutoff })); return filtros.get(k); };
  return {
    // lm: [{x,y,z,visibility}]; devolve cópia filtrada. Em z o corte é mais forte: a profundidade é o eixo mais ruidoso (REPERTORIO 32.3).
    filtrar(lm, tSeg) {
      return lm.map((p, i) => ({ ...p, x: f(i, 'x').filtrar(p.x, tSeg), y: f(i, 'y').filtrar(p.y, tSeg), z: f(i, 'z').filtrar(p.z, tSeg) }));
    },
    zerar() { filtros.clear(); },
  };
}

// Ganho de uma parte do corpo (0 a 1). Abaixo do limiar por `quadros` quadros seguidos, desce até 0 em `rampaMs`; ao voltar, sobe
// na mesma rampa. Assim a parte sai do rastreamento e volta ao clipe sem salto.
export function criarGanho({ limiar = 0.5, quadros = 4, rampaMs = 300 } = {}) {
  let ganho = 0, ruins = 0, bons = 0, alvo = 0;
  return {
    atualizar(confianca, dtSeg) {
      if (confianca >= limiar) { bons++; ruins = 0; if (bons >= Math.min(quadros, 3)) alvo = 1; }
      else { ruins++; bons = 0; if (ruins >= quadros) alvo = 0; }
      const passo = dtSeg / (rampaMs / 1000);
      ganho = alvo > ganho ? Math.min(alvo, ganho + passo) : Math.max(alvo, ganho - passo);
      return ganho;
    },
    get valor() { return ganho; },
    zerar() { ganho = 0; ruins = 0; bons = 0; alvo = 0; },
  };
}

// Suaviza a rotação de um osso: limita a velocidade angular (rad/s) e aproxima por constante de tempo.
export function suavizarOsso(atual, alvo, dtSeg, { velMax = 8, tau = 0.06 } = {}) {
  if (!atual) return alvo;
  const limitado = qAndar(atual, alvo, velMax * dtSeg);
  return qSlerp(atual, limitado, 1 - Math.exp(-dtSeg / tau));
}
