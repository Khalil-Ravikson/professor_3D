// Motor ElevenLabs, SEMPRE por um proxy local (prompt 3, U4): a chave (ELEVENLABS_API_KEY) fica no processo do proxy e nunca
// chega ao navegador. Sem endereço de proxy configurado, o motor se declara indisponível e a cadeia segue para o Kokoro.
//
// API conferida na documentação oficial em 07/10/2026 (elevenlabs.io/docs/api-reference/text-to-speech/convert):
//   POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128  cabeçalho xi-api-key  corpo { text, model_id, voice_settings }
//   resposta: o arquivo de áudio. `language_code` NÃO vale para os modelos multilingual_v2.
// Modelos com português, segundo a página de modelos da mesma data: eleven_multilingual_v2, eleven_flash_v2_5 (o mais barato
// para API), eleven_v3. O eleven_flash_v2 (sem 2.5) é só inglês: não usar.
// Preços por 1.000 caracteres (elevenlabs.io/pricing/api, 07/10/2026, dólares): Flash/Turbo 0,04; Multilingual v2 e v3 0,08.
// Plano gratuito: 10.000 caracteres nos modelos v2/v3 e 20.000 no Flash (a página não rotula a linha como "gratuito",
// leitura por posição); termos de uso (seção 1c): no plano gratuito só uso NÃO comercial.
export const MODELOS_ELEVENLABS = {
  eleven_flash_v2_5: { usdPorMil: 0.04, nome: 'Flash v2.5' },
  eleven_multilingual_v2: { usdPorMil: 0.08, nome: 'Multilingual v2' },
  eleven_v3: { usdPorMil: 0.08, nome: 'v3' },
};
export const ELEVENLABS_FONTE = 'elevenlabs.io/pricing/api e /docs/overview/models, consultadas em 07/10/2026';
export const ELEVENLABS_AVISO_LICENCA = 'No plano gratuito do ElevenLabs só é permitido uso não comercial (termos, seção 1c). Uso no evento exige plano pago ou confirmação por escrito deles.';

export const usdDoTexto = (texto, modelo) => {
  const m = MODELOS_ELEVENLABS[modelo];
  return m ? (String(texto).length / 1000) * m.usdPorMil : null;
};

const semBarra = (u) => String(u || '').trim().replace(/\/+$/, '');

export function criarElevenLabs({ obterConfig }) {
  return {
    id: 'elevenlabs',
    nome: 'ElevenLabs (via proxy local)',
    direto: false,
    suportaVoz() { return true },
    disponivel() {
      const c = obterConfig() || {};
      if (!semBarra(c.proxy)) return { ok: false, aviso: 'O ElevenLabs precisa do endereço do proxy local.' };
      return { ok: true };
    },
    // voz.elevenlabs = { voiceId, modelo }. O modelo padrão é o mais barato com português.
    async sintetizar(texto, voz, { signal, ctx, aoMedir }) {
      const c = obterConfig() || {};
      const proxy = semBarra(c.proxy);
      const cfg = (voz && voz.elevenlabs) || {};
      if (!proxy) throw Object.assign(new Error('Sem proxy local para o ElevenLabs.'), { status: 0 });
      if (!cfg.voiceId) throw Object.assign(new Error('Falta o voiceId do ElevenLabs.'), { status: 0 });
      const modelo = cfg.modelo || 'eleven_flash_v2_5';
      if (!MODELOS_ELEVENLABS[modelo]) throw Object.assign(new Error(`Modelo ${modelo} fora da tabela de preços.`), { status: 0 });
      const t0 = performance.now();
      const r = await fetch(`${proxy}/elevenlabs/v1/text-to-speech/${encodeURIComponent(cfg.voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: texto, model_id: modelo, ...(cfg.voiceSettings ? { voice_settings: cfg.voiceSettings } : {}) }),
      });
      const tCabecalho = performance.now() - t0;
      if (!r.ok) { const e = new Error(`ElevenLabs/proxy respondeu HTTP ${r.status}`); e.status = r.status; throw e; }
      const buf = await ctx.decodeAudioData(await r.arrayBuffer());
      if (aoMedir) aoMedir({ ms: performance.now() - t0, msCabecalho: tCabecalho, caracteres: texto.length, modelo, usd: usdDoTexto(texto, modelo) });
      return buf;
    },
  };
}
