// Voz mãos-livres (prompt 2, R5): detecção de voz com Silero VAD (@ricky0123/vad-web 0.0.31) rodando no navegador.
// Os arquivos ficam em assets/vad/ (ver assets/vad/CREDITS.md): bundle, worklet, modelo e onnxruntime-web 1.22.0, a
// versão com que o vad-web foi construído. Nada é baixado de CDN e nenhum áudio sai do computador nem é gravado:
// o trecho de fala fica em memória só até a transcrição.
//
// API conferida no código-fonte do pacote (dist/real-time-vad.js): MicVAD.new({ baseAssetPath, onnxWASMBasePath, model,
// ortConfig, getStream, positiveSpeechThreshold, negativeSpeechThreshold, redemptionMs, preSpeechPadMs, minSpeechMs,
// onSpeechStart, onSpeechRealStart, onSpeechEnd, onVADMisfire }). onSpeechEnd entrega Float32Array a 16 kHz.
// Valores abaixo NÃO CALIBRADOS: ajustar no totem, com o barulho do local e crianças de verdade.

// URL absoluta: o onnxruntime importa o .mjs por esse caminho, e um relativo sem "./" vira módulo nu e falha.
const BASE = new URL('assets/vad/', location.href).href;

// Padrões do pacote: voz a partir de 0,3, silêncio de 1,4 s para fechar a fala, 400 ms mínimos.
// Aqui: limiar de voz maior (menos disparo por eco do alto-falante) e silêncio de 1 s (menos espera depois da fala).
export const OPCOES_PADRAO = {
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
  redemptionMs: 1000,
  preSpeechPadMs: 600,
  minSpeechMs: 400,
};

function carregarScript(src) {
  return new Promise((ok, falha) => {
    const ja = [...document.scripts].find((s) => s.src.endsWith(src));
    if (ja && ja.dataset.carregado) { ok(); return; }
    const s = ja || document.createElement('script');
    s.addEventListener('load', () => { s.dataset.carregado = '1'; ok(); }, { once: true });
    s.addEventListener('error', () => falha(new Error(`não carregou ${src}`)), { once: true });
    if (!ja) { s.src = src; document.head.appendChild(s); }
  });
}

// O bundle espera o global `ort` (UMD: vad = t(ort)), então o onnxruntime vem primeiro.
export async function carregarVad() {
  if (window.vad && window.vad.MicVAD) return window.vad;
  await carregarScript(`${BASE}ort.wasm.min.js`);
  await carregarScript(`${BASE}vad-web.bundle.min.js`);
  if (!window.vad || !window.vad.MicVAD) throw new Error('o vad-web carregou mas não expôs MicVAD');
  return window.vad;
}

// aoFalaReal: a pessoa começou a falar de verdade (passou dos 400 ms), usado para interromper o personagem.
// aoFimDeFala(audio16k): trecho pronto para transcrever.
export async function criarMaosLivres({ aoFalaReal = () => {}, aoFimDeFala = () => {}, aoDescartar = () => {}, opcoes = {} } = {}) {
  const vad = await carregarVad();
  const mic = await vad.MicVAD.new({
    ...OPCOES_PADRAO, ...opcoes,
    model: 'legacy',
    baseAssetPath: BASE,
    onnxWASMBasePath: BASE,
    ortConfig: (ort) => { ort.env.logLevel = 'error'; ort.env.wasm.numThreads = 1; }, // sem isolamento de origem não há threads
    // Eco: o alto-falante realimenta o microfone. echoCancellation ligado; fone de ouvido resolve de vez.
    getStream: () => navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
    onSpeechRealStart: () => aoFalaReal(),
    onSpeechEnd: (audio) => aoFimDeFala(audio),
    onVADMisfire: () => aoDescartar(),
  });
  return {
    pausar: () => mic.pause(),
    retomar: () => mic.start(),
    async destruir() { try { await mic.destroy(); } catch (e) { console.warn('[maos-livres] destroy falhou:', e); } },
  };
}
