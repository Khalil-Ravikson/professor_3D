// Entrada por voz: SpeechRecognition do navegador; se não houver (ou der erro de rede,
// como no Brave), cai para Whisper local via transformers.js.
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

export function criarOuvido({ aoOuvirParcial, aoOuvirFinal, aoMudarEstado, aoProgresso }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let usarSR = !!SR, sr = null, textoSR = '', gravando = false;
  let asr = null, recorder = null, stream = null, pedacos = [], autoParar = null;
  // Sobe a cada cancelar(); uma transcrição que começou antes é descartada.
  let geracao = 0, geracaoDaGravacao = 0;

  function iniciarSR() {
    textoSR = '';
    sr = new SR();
    sr.lang = 'pt-BR'; sr.interimResults = true; sr.continuous = false;
    sr.onresult = (ev) => {
      textoSR = Array.from(ev.results).map((r) => r[0].transcript).join('');
      aoOuvirParcial(textoSR);
    };
    sr.onerror = (ev) => {
      gravando = false; textoSR = '';
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') aoMudarEstado('idle', 'O microfone está bloqueado. Clique no cadeado da barra de endereço e permita.');
      else if (ev.error === 'network') { usarSR = false; aoMudarEstado('idle', 'Preparando outro jeito de ouvir...'); carregarWhisper(); }
      else if (ev.error === 'no-speech') aoMudarEstado('idle', 'Não ouvi nada. Tente de novo!');
      else if (ev.error !== 'aborted') aoMudarEstado('idle', 'Não consegui ouvir. Tente de novo ou escreva.');
    };
    const minha = geracao;
    sr.onend = () => {
      if (minha !== geracao) return;
      const estava = gravando; gravando = false;
      if (textoSR.trim()) aoOuvirFinal(textoSR);
      else if (estava) aoMudarEstado('idle', 'Não ouvi nada. Tente de novo!');
    };
    try { gravando = true; sr.start(); aoMudarEstado('listening'); }
    catch (e) { console.warn('[ouvido] sr.start falhou:', e); gravando = false; aoMudarEstado('idle', 'Tente apertar de novo.'); }
  }

  async function carregarWhisper() {
    aoMudarEstado('loading-ear');
    try {
      const { pipeline } = await import(TRANSFORMERS_URL);
      asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
        progress_callback: (p) => {
          if (p.status === 'progress' && typeof p.progress === 'number') aoProgresso(Math.round(p.progress));
        },
      });
      aoMudarEstado('idle');
    } catch (e) {
      console.error('[ouvido] Whisper não carregou:', e);
      aoMudarEstado('idle', 'Não consegui preparar o microfone. Use os botões ou escreva.');
    }
  }

  async function iniciarGravacao() {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { console.warn('[ouvido] getUserMedia:', e); aoMudarEstado('idle', 'O microfone está bloqueado. Clique no cadeado da barra de endereço e permita.'); return; }
    pedacos = [];
    geracaoDaGravacao = geracao;
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (ev) => { if (ev.data.size) pedacos.push(ev.data); };
    recorder.onstop = transcrever;
    recorder.start(); gravando = true; aoMudarEstado('listening');
    autoParar = setTimeout(pararGravacao, 20000);
  }

  function pararGravacao() {
    clearTimeout(autoParar);
    if (recorder && gravando) { gravando = false; recorder.stop(); }
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  async function transcrever() {
    const minha = geracao;
    if (minha !== geracaoDaGravacao) return;
    aoMudarEstado('thinking', 'Entendendo o que você disse...');
    try {
      const buf = await new Blob(pedacos).arrayBuffer();
      const ctx = new AudioContext({ sampleRate: 16000 });
      const audio = (await ctx.decodeAudioData(buf)).getChannelData(0);
      ctx.close();
      const out = await asr(audio, { language: 'portuguese', task: 'transcribe' });
      if (minha !== geracao) return;
      const q = (out.text || '').trim();
      if (!q) { aoMudarEstado('idle', 'Não ouvi nada. Tente de novo!'); return; }
      aoOuvirFinal(q);
    } catch (e) {
      console.error('[ouvido] transcrição falhou:', e);
      aoMudarEstado('idle', 'Não consegui entender o áudio. Tente de novo ou escreva.');
    }
  }

  return {
    get gravando() { return gravando; },
    async preparar() {
      if (navigator.brave) {
        try { if (await navigator.brave.isBrave()) usarSR = false; }
        catch (e) { console.warn('[ouvido] detecção do Brave falhou:', e); }
      }
      if (usarSR) aoMudarEstado('idle'); else await carregarWhisper();
    },
    // Para de ouvir e joga fora o que foi captado (troca de personagem).
    cancelar() {
      geracao++;
      if (!gravando) return;
      if (usarSR) { gravando = false; sr.abort(); }
      else pararGravacao();
    },
    alternar() {
      if (gravando) { usarSR ? sr.stop() : pararGravacao(); return false; }
      usarSR ? iniciarSR() : iniciarGravacao();
      return true;
    },
  };
}
