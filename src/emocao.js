// Camada de emoção (prompt 2, R2). O LLM pode marcar uma sentença com [emo:alegre]. A marca viaja com a sentença
// até a voz, que a tira antes de sintetizar e avisa quando a sentença começa a tocar (como o gesto, em gestos.js).
// Marca com nome fora da lista cai em "neutro". Marca solta nunca vai para o áudio, nem malformada.

export const EMOCOES = ['neutro', 'alegre', 'pensativo', 'surpreso', 'curioso', 'empatico'];

// Pesos de expressão VRM, baixos de propósito: a boca é do lip sync e o rosto não pode virar máscara.
// O VRM 0.x não tem "surprised"; avatar.js ignora a expressão que o modelo não tiver.
export const EXPRESSOES = {
  neutro: {},
  alegre: { happy: 0.35 },
  pensativo: { relaxed: 0.3 },
  surpreso: { surprised: 0.4 },
  curioso: { surprised: 0.15, happy: 0.1 },
  empatico: { sad: 0.2, relaxed: 0.1 },
};

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Marca completa: [emo:nome]. Qualquer coisa que comece com "[emo" e não feche entra na limpeza de segurança.
const MARCA = /\[emo:\s*([^\]\s]*)\s*\]\s*/gi;
// Só a marca (e uma palavra depois do ":"): nunca o resto da frase, para uma marca sem "]" não engolir fala.
const SOLTA = /\[\s*emo(?:\s*:\s*\p{L}*)?\s*\]?\s*/giu;

export function normalizarEmocao(nome) {
  const n = semAcento(String(nome || '').trim());
  return EMOCOES.includes(n) ? n : 'neutro';
}

// Devolve o texto sem marca e a emoção da última marca da sentença (ou null se não havia marca).
export function extrairEmocao(texto) {
  let emocao = null;
  let limpo = texto.replace(MARCA, (_, nome) => { emocao = normalizarEmocao(nome); return ''; });
  limpo = limpo.replace(SOLTA, (m) => { if (emocao === null) emocao = 'neutro'; return ''; });
  return { texto: limpo, emocao };
}

// Para mostrar na tela: tira marcas completas e uma marca ainda incompleta no fim do texto em streaming.
export function removerEmocao(texto) {
  return texto.replace(MARCA, '').replace(SOLTA, '').replace(/\[(e(m(o(:[^\]\s]*)?)?)?)?$/i, '');
}

export function instrucaoEmocao() {
  return ` Emoção: no começo de uma frase você pode escrever uma marca [emo:nome] com um destes nomes: ${EMOCOES.join(', ')}. ` +
    'Use só quando combinar com o que a frase diz. Não invente outros nomes e não fale a marca.';
}
