// Projeção de gasto do Gemini: quanto custam N respostas, com os tokens MEDIDOS (usageMetadata) quando houver
// e com a premissa do REPERTORIO 23 quando não houver. Preços vêm de custo.js (texto) e tts/gemini.js (voz).
// Nada aqui chama a rede. Modelo sem preço na tabela devolve null, nunca um chute.
import { PRECOS_USD, chaveDoModelo, precoVigente, CAMBIO_PADRAO } from './custo.js';
import { PRECOS_TTS, TOKENS_POR_SEGUNDO, MUDANCA_DE_PRECO } from './tts/gemini.js';

// REPERTORIO 23 e 30.2: premissas a trocar pelo medido assim que houver respostas reais.
export const PREMISSA = { entrada: 2000, saida: 200, pensamento: 0, caracteresFala: 300, caracteresPorSegundo: 15 };

// Média por resposta a partir do medidor de custo (resumo()). Sem respostas, devolve a premissa e diz que é premissa.
export function mediaPorResposta(resumo) {
  const n = resumo && resumo.respostas;
  if (!n) return { ...PREMISSA, medido: false, amostras: 0 };
  return {
    entrada: resumo.entrada / n, saida: resumo.saida / n, pensamento: (resumo.pensamento || 0) / n,
    caracteresFala: PREMISSA.caracteresFala, caracteresPorSegundo: PREMISSA.caracteresPorSegundo,
    medido: true, amostras: n,
  };
}

export function usdTexto(modelo, { entrada, saida, pensamento = 0 }) {
  const p = precoVigente(PRECOS_USD[chaveDoModelo(modelo)]);
  if (!p) return null;
  // Pensamento é cobrado como saída.
  return (entrada / 1e6) * p.entrada + ((saida + pensamento) / 1e6) * p.saida;
}

export function usdVoz(modeloTts, { caracteres, caracteresPorSegundo = PREMISSA.caracteresPorSegundo, data = new Date() }) {
  const p = PRECOS_TTS[modeloTts];
  if (!p || !caracteres) return null;
  const i = data >= new Date(MUDANCA_DE_PRECO) ? 1 : 0;
  const tokensSaida = Math.round((caracteres / caracteresPorSegundo) * TOKENS_POR_SEGUNDO);
  const tokensEntrada = Math.ceil(caracteres / 4); // sem tokenizador aqui: 1 token a cada 4 caracteres (estimativa)
  return (tokensEntrada / 1e6) * p.entrada[i] + (tokensSaida / 1e6) * p.saida[i];
}

// Uma linha por modelo de texto conhecido, com e sem a voz do Gemini.
export function projetar({ respostas = 5000, media = PREMISSA, cambio = CAMBIO_PADRAO, modeloTts = null, fracaoComVoz = 1, data = new Date() } = {}) {
  const voz = modeloTts ? usdVoz(modeloTts, { caracteres: media.caracteresFala, caracteresPorSegundo: media.caracteresPorSegundo, data }) : null;
  return Object.keys(PRECOS_USD).map((modelo) => {
    const t = usdTexto(modelo, media);
    const porResposta = t + (voz === null ? 0 : voz * fracaoComVoz);
    return {
      modelo, texto: t, voz: voz === null ? null : voz * fracaoComVoz,
      usdPorResposta: porResposta, reaisPorResposta: porResposta * cambio,
      usdTotal: porResposta * respostas, reaisTotal: porResposta * respostas * cambio, respostas,
    };
  });
}

// Quantas respostas cabem num teto em reais, para o modelo escolhido.
export function respostasQueCabem(tetoReais, { modelo, media = PREMISSA, cambio = CAMBIO_PADRAO, modeloTts = null }) {
  const t = usdTexto(modelo, media);
  if (t === null) return null;
  const voz = modeloTts ? usdVoz(modeloTts, { caracteres: media.caracteresFala, caracteresPorSegundo: media.caracteresPorSegundo }) : 0;
  const por = (t + (voz || 0)) * cambio;
  return por > 0 ? Math.floor(tetoReais / por) : null;
}

// Cloud Text-to-Speech tradicional: cobrado por caractere, com franquia mensal grátis por tipo de voz.
// Fonte: cloud.google.com/text-to-speech/pricing, lida em 07/10/2026. A página não diz quais tipos têm voz em pt-BR;
// conferir na lista de vozes antes de escolher um (NÃO CONFERIDO).
export const PRECOS_CLOUD_TTS = {
  standard: { usdPorMilhao: 4, gratisMes: 4_000_000 },
  wavenet: { usdPorMilhao: 4, gratisMes: 4_000_000 },
  neural2: { usdPorMilhao: 16, gratisMes: 1_000_000 },
  polyglot: { usdPorMilhao: 16, gratisMes: 1_000_000 },
  'chirp3-hd': { usdPorMilhao: 30, gratisMes: 1_000_000 },
  studio: { usdPorMilhao: 160, gratisMes: 1_000_000 },
};

// caracteresNoMes: soma do mês inteiro, porque a franquia é mensal e por tipo de voz.
export function usdCloudTts(tipo, caracteresNoMes) {
  const p = PRECOS_CLOUD_TTS[tipo];
  if (!p || !(caracteresNoMes >= 0)) return null;
  return (Math.max(0, caracteresNoMes - p.gratisMes) / 1e6) * p.usdPorMilhao;
}
