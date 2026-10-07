// Gemini TTS (Interactions API). Partes puras: montar o pedido, achar o áudio na resposta,
// ler o cabeçalho WAV e calcular o custo. Sem DOM, então o laboratório de linha de comando
// (tools/lab-voz.mjs) e o motor do navegador usam o mesmo código.
//
// Fonte (lida em 06/10/2026): ai.google.dev/gemini-api/docs/speech-generation.
// - Endpoint: POST /v1beta/interactions, cabeçalho x-goog-api-key.
// - Corpo: model, input[{type:'user_input', content:[{type:'text', text, annotations:[{type:'speech_metadata', style}]}]}],
//   response_format{type:'audio'}, generation_config{speech_config:[{voice}]}.
// - Resposta: o áudio vem em base64 em steps[].content[].data, no item de type 'audio' do passo 'model_output'.
//   Unário devolve WAV (RIFF, 24 kHz, mono, 16 bits). Streaming usa audio/l16 sem cabeçalho.
// Não inventar campo: o que a documentação não mostra fica de fora (limite de texto, por exemplo, não é documentado).

export const URL_INTERACTIONS = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const TAXA_PADRAO = 24000;

// Nomes e preços mudam rápido (REPERTORIO 30): o id do modelo é configurável e esta tabela é editável.
// Preço em dólares por milhão de tokens, plano pago, página oficial de preços em 06/10/2026.
// Os preços de 2026 sobem em 01/01/2027: a tabela guarda os dois.
export const PRECOS_TTS = {
  'gemini-3.8-flash-tts': { entrada: [0.5, 1.0], saida: [9.0, 18.0] },
  'gemini-3.8-flash-lite-tts': { entrada: [0.5, 1.0], saida: [6.0, 12.0] },
  'gemini-3.1-flash-tts-preview': { entrada: [1.0, 1.0], saida: [20.0, 20.0] },
  // cloud.google.com/text-to-speech/pricing, lida em 07/10/2026. O id exato na API pode ter sufixo: conferir ao ativar.
  'gemini-2.5-flash-tts': { entrada: [0.5, 0.5], saida: [10.0, 10.0] },
  'gemini-2.5-pro-tts': { entrada: [1.0, 1.0], saida: [20.0, 20.0] },
};
export const TOKENS_POR_SEGUNDO = 25; // página de preços: "25 tokens per second of audio" (documentado para os modelos 3.8)
export const MUDANCA_DE_PRECO = '2027-01-01';

export function montarPedido({ modelo, texto, voz = 'Kore', estilo = '', stream = false, formato = null }) {
  const conteudo = { type: 'text', text: texto };
  if (estilo) conteudo.annotations = [{ type: 'speech_metadata', style: estilo }];
  const corpo = {
    model: modelo,
    input: [{ type: 'user_input', content: [conteudo] }],
    response_format: formato ? { type: 'audio', ...formato } : { type: 'audio' },
    generation_config: { speech_config: [{ voice: voz }] },
  };
  if (stream) corpo.stream = true;
  return corpo;
}

// O último item de áudio entre os passos de saída do modelo. Devolve a string base64 ou null.
export function extrairAudioBase64(resposta) {
  const passos = (resposta && resposta.steps) || [];
  const audios = [];
  for (const p of passos) {
    if (p.type !== 'model_output') continue;
    for (const c of p.content || []) if (c.type === 'audio' && c.data) audios.push(c.data);
  }
  return audios.length ? audios[audios.length - 1] : null;
}

// Cabeçalho WAV mínimo: formato PCM de 16 bits. Devolve a duração em segundos medida nos bytes.
export function lerWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t = (p) => String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
  if (bytes.byteLength < 44 || t(0) !== 'RIFF' || t(8) !== 'WAVE') throw new Error('a resposta não é WAV');
  let p = 12, fmt = null, dados = null;
  while (p + 8 <= v.byteLength) {
    const id = t(p), tam = v.getUint32(p + 4, true);
    if (id === 'fmt ') fmt = { formato: v.getUint16(p + 8, true), canais: v.getUint16(p + 10, true), taxa: v.getUint32(p + 12, true), bits: v.getUint16(p + 22, true) };
    else if (id === 'data') dados = { inicio: p + 8, tam: Math.min(tam, v.byteLength - p - 8) };
    p += 8 + tam + (tam % 2);
  }
  if (!fmt || !dados) throw new Error('WAV sem fmt ou sem data');
  const porQuadro = fmt.canais * (fmt.bits / 8);
  return { ...fmt, bytes: dados.tam, segundos: dados.tam / porQuadro / fmt.taxa, inicioDados: dados.inicio };
}

// PCM de 16 bits sem cabeçalho (audio/l16) vira segundos.
export function segundosDePcm(bytes, taxa = TAXA_PADRAO, canais = 1) { return bytes / (2 * canais) / taxa; }

const base64ParaBytes = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'));
export function decodificarBase64(b64) {
  if (typeof Buffer !== 'undefined') return base64ParaBytes(b64);
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Custo em dólares. Tokens de saída: os que a API informar; sem isso, 25 por segundo de áudio.
// Tokens de entrada: os informados; sem isso, uma estimativa de 1 token a cada 4 caracteres.
export function custoUsd(modelo, { segundos, tokensSaida = null, tokensEntrada = null, chars = 0, data = new Date() }) {
  const p = PRECOS_TTS[modelo];
  if (!p) return { usd: null, motivo: `sem preço para ${modelo}` };
  const i = data >= new Date(MUDANCA_DE_PRECO) ? 1 : 0;
  const tSaida = tokensSaida ?? Math.round(segundos * TOKENS_POR_SEGUNDO);
  const tEntrada = tokensEntrada ?? Math.ceil(chars / 4);
  const usd = (tEntrada / 1e6) * p.entrada[i] + (tSaida / 1e6) * p.saida[i];
  return { usd, tokensSaida: tSaida, tokensEntrada: tEntrada, estimado: tokensSaida === null };
}
