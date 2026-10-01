// Kokoro-FastAPI local (remsky/Kokoro-FastAPI, testado com v0.9.0).
// API compatível com a de fala da OpenAI. CORS vem liberado (allow-origin *).
// Não usamos timestamps por palavra (/dev/captioned_speech): há relato de timestamps nulos.

// 127.0.0.1 e não localhost: no Windows, localhost tenta IPv6 (::1) primeiro e atrasa ~250 ms.
export const URL_PADRAO = 'http://127.0.0.1:8880';

export function normalizarUrl(url) {
  return (url || URL_PADRAO).trim().replace(/\/+$/, '');
}

export function criarKokoroServidor({ obterUrl }) {
  return {
    id: 'kokoro-server',
    nome: 'Kokoro (servidor local)',
    direto: false,

    // GET /v1/audio/voices. Na v0.9.0 cada voz é um objeto { id, name, ... }; aceita string também.
    async verificar({ timeoutMs = 3000 } = {}) {
      const ctl = new AbortController();
      const relogio = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetch(normalizarUrl(obterUrl()) + '/v1/audio/voices', { signal: ctl.signal });
        if (!r.ok) return { ok: false, detalhe: `respondeu HTTP ${r.status}` };
        const dados = await r.json();
        const vozes = (dados.voices || []).map((v) => (typeof v === 'string' ? v : v.id));
        return { ok: true, vozes, detalhe: `${vozes.length} vozes` };
      } catch (e) {
        return { ok: false, detalhe: e.name === 'AbortError' ? 'não respondeu a tempo' : 'não respondeu' };
      } finally {
        clearTimeout(relogio);
      }
    },

    suportaVoz() { return true },

    // voz.id aceita mistura no formato do servidor, ex.: "pm_alex(1)+pm_santa(1)".
    async sintetizar(texto, voz, { signal, ctx }) {
      const r = await fetch(normalizarUrl(obterUrl()) + '/v1/audio/speech', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'kokoro', input: texto, voice: voz.id, response_format: 'wav', speed: voz.speed ?? 1 }),
      });
      if (!r.ok) throw new Error(`Kokoro respondeu HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return ctx.decodeAudioData(await r.arrayBuffer());
    },
  };
}
