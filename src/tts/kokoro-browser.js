// kokoro-js no navegador. Verificado em 30/09/2026 rodando list_voices() na 1.2.1:
// só 28 vozes en-us/en-gb, e "pf_dora" dá "Voice not found". Então serve só para
// personagens que falam inglês; português vai pelo kokoro-server.

const URL_KOKORO_JS = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const MODELO = 'onnx-community/Kokoro-82M-v1.0-ONNX';

async function temWebGPU() {
  if (!navigator.gpu) return false;
  try {
    return !!(await navigator.gpu.requestAdapter());
  } catch (e) {
    console.warn('[kokoro-browser] requestAdapter falhou, usando wasm:', e);
    return false;
  }
}

export function criarKokoroNavegador({ aoProgresso } = {}) {
  let tts = null, carregando = null, dispositivo = null;

  function progresso(p) {
    if (aoProgresso && p.status === 'progress' && typeof p.progress === 'number') aoProgresso(Math.round(p.progress));
  }

  async function carregarNo(device) {
    const { KokoroTTS } = await import(URL_KOKORO_JS);
    // README do kokoro-js: fp32 no WebGPU, q8 no wasm.
    const dtype = device === 'webgpu' ? 'fp32' : 'q8';
    const t = await KokoroTTS.from_pretrained(MODELO, { dtype, device, progress_callback: progresso });
    dispositivo = device;
    return t;
  }

  async function carregar() {
    if (tts) return tts;
    if (!carregando) {
      carregando = (async () => {
        if (await temWebGPU()) {
          try { return await carregarNo('webgpu'); }
          catch (e) { console.warn('[kokoro-browser] WebGPU falhou, tentando wasm:', e); }
        }
        return carregarNo('wasm');
      })();
    }
    try {
      tts = await carregando;
      return tts;
    } catch (e) {
      carregando = null;
      throw e;
    }
  }

  return {
    id: 'kokoro-browser',
    nome: 'Kokoro no navegador (só inglês)',
    direto: false,
    carregar,
    get dispositivo() { return dispositivo; },

    async verificar() {
      if (!tts) return { ok: null, detalhe: 'ainda não carregado' };
      const vozes = Object.keys(tts.voices);
      return { ok: true, vozes, detalhe: `${dispositivo}, ${vozes.length} vozes (inglês)` };
    },

    suportaVoz(voz) { return /^[ab][fm]_/.test(voz.id) },

    async sintetizar(texto, voz, { signal, ctx }) {
      const t = await carregar();
      if (signal && signal.aborted) throw new DOMException('cancelado', 'AbortError');
      // generate() não aceita AbortSignal; o resultado é descartado se cancelaram no meio.
      const bruto = await t.generate(texto, { voice: voz.id, speed: voz.speed ?? 1 });
      if (signal && signal.aborted) throw new DOMException('cancelado', 'AbortError');
      const buffer = ctx.createBuffer(1, bruto.audio.length, bruto.sampling_rate);
      buffer.copyToChannel(bruto.audio, 0);
      return buffer;
    },
  };
}
