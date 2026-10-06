// Motor "Gemini TTS" para o navegador. Mesma interface dos outros motores:
//   sintetizar(texto, voz, { signal, ctx }) -> Promise<AudioBuffer>
// Uma chamada por sentença, no modo unário: o app já sintetiza a sentença seguinte enquanto a atual toca,
// então só a primeira sentença espera o tempo cheio (3 a 5 s no laboratório). O streaming (primeiro áudio
// em 1 a 2 s) pede tocar por pedaços e fica como próximo passo; ver REPERTORIO, log de 06/10/2026.
//
// A chave é a mesma do Gemini de texto, guardada neste navegador. O REPERTORIO (seção 23) manda chave paga
// ficar num proxy local; aqui ela está no navegador por escolha do dono, e a tela de configurações avisa.
import { montarPedido, URL_INTERACTIONS, extrairAudioBase64, decodificarBase64, lerWav, custoUsd } from './gemini.js';

export class ErroGeminiTts extends Error {
  constructor(status, detalhe) {
    super(`Gemini TTS respondeu HTTP ${status}`);
    this.name = 'ErroGeminiTts';
    this.status = status;
    this.detalhe = detalhe;
  }
}

// obterConfig() -> { chave, modelo, voz, estilo, aoMedir }. Lido a cada chamada, para mudar nas configurações valer na hora.
export function criarGeminiTts({ obterConfig }) {
  return {
    id: 'gemini',
    nome: 'Gemini TTS',
    direto: false,

    // O Gemini tem voz própria por nome (Kore, Puck...), e cada personagem pode ter a sua em voz.gemini.
    suportaVoz() { return true; },

    async sintetizar(texto, voz, { signal, ctx }) {
      const cfg = obterConfig();
      if (!cfg.chave) throw new ErroGeminiTts(401, 'sem chave do Gemini');
      const g = (voz && voz.gemini) || {};
      const corpo = montarPedido({
        modelo: cfg.modelo,
        texto,
        voz: g.voz || cfg.voz || 'Kore',
        // Estilo do personagem tem prioridade sobre o global: é a vantagem do Gemini sobre o Kokoro.
        estilo: g.estilo ?? cfg.estilo ?? '',
      });
      const t0 = performance.now();
      const r = await fetch(URL_INTERACTIONS, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.chave },
        body: JSON.stringify(corpo),
      });
      const tCabecalhos = performance.now();
      const bruto = await r.text();
      if (!r.ok) throw new ErroGeminiTts(r.status, bruto.slice(0, 300));
      let json;
      try { json = JSON.parse(bruto); } catch (e) { throw new ErroGeminiTts(r.status, 'resposta que não é JSON'); }
      const b64 = extrairAudioBase64(json);
      if (!b64) throw new ErroGeminiTts(r.status, 'a resposta não trouxe áudio');
      const bytes = decodificarBase64(b64);
      const wav = lerWav(bytes);
      const total = performance.now() - t0;
      const u = json.usage || {};
      const custo = custoUsd(cfg.modelo, { segundos: wav.segundos, tokensSaida: u.total_output_tokens ?? null, tokensEntrada: u.total_input_tokens ?? null, chars: texto.length });
      if (cfg.aoMedir) {
        cfg.aoMedir({
          modelo: cfg.modelo, voz: corpo.generation_config.speech_config[0].voice, chars: texto.length,
          cabecalhosMs: Math.round(tCabecalhos - t0), totalMs: Math.round(total), segundos: +wav.segundos.toFixed(2),
          tokensSaida: custo.tokensSaida, usd: custo.usd,
        });
      }
      // decodeAudioData consome o buffer: cópia limpa do trecho exato do arquivo.
      return ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    },
  };
}
