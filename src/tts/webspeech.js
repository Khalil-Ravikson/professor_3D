import { ler, gravar } from '../storage.js';

// Vozes pt-BR conhecidas por gênero (Edge/Windows "Natural", Chrome, macOS). Usado só para
// escolher a voz automática do personagem; a escolha manual nas configurações tem prioridade.
const FEMININAS = /francisca|thalita|giovanna|leila|manuela|brenda|elza|leticia|yara|luciana|maria|vit[oó]ria|\bfemale\b|feminin/i;
const MASCULINAS = /ant[oô]nio|donato|f[aá]bio|humberto|j[uú]lio|nicolau|valerio|daniel|\bmale\b|masculin/i;

function pontuar(v, genero) {
  let s = 0;
  if (/pt[-_]BR/i.test(v.lang)) s += 4;
  if (/natural/i.test(v.name)) s += 8; // vozes neurais do Edge: "Microsoft Francisca Online (Natural)"
  if (/online/i.test(v.name)) s += 1;
  const f = FEMININAS.test(v.name), m = MASCULINAS.test(v.name);
  if (genero === 'f') s += f ? 3 : m ? -5 : 0;
  if (genero === 'm') s += m ? 3 : f ? -5 : 0;
  return s;
}

// Voz do sistema (Web Speech). Último recurso: o áudio não passa pelo AudioContext,
// então não há nó para o lip sync; a boca usa o evento de palavra (onboundary).
export function criarWebSpeech({ aoMudarVozes } = {}) {
  const synth = window.speechSynthesis;
  let vozes = [], manual = null, preparado = false;
  let nomeManual = ler('voice'); // '' = automática por personagem

  function carregarVozes() {
    if (!synth) return;
    vozes = synth.getVoices().filter((v) => /^pt/i.test(v.lang));
    manual = nomeManual ? vozes.find((v) => v.name === nomeManual) || null : null;
    if (aoMudarVozes) aoMudarVozes(vozes, manual);
  }

  function vozPara(voz) {
    if (manual) return manual;
    let melhor = null, nota = -Infinity;
    for (const v of vozes) {
      const n = pontuar(v, voz && voz.genero);
      if (n > nota) { nota = n; melhor = v; }
    }
    return melhor;
  }
  if (synth) { carregarVozes(); synth.onvoiceschanged = carregarVozes; }

  return {
    id: 'webspeech',
    nome: 'Voz do sistema',
    direto: true,
    disponivel: !!synth,
    suportaVoz() { return true },
    async verificar() { return synth ? { ok: true, detalhe: `${vozes.length} vozes em português` } : { ok: false, detalhe: 'sem Web Speech' }; },

    // Toca direto e resolve quando termina (ou é cancelada).
    falar(texto, voz, { signal, aoPalavra } = {}) {
      return new Promise((resolver) => {
        if (!synth || (signal && signal.aborted)) { resolver(); return; }
        const u = new SpeechSynthesisUtterance(texto);
        const v = vozPara(voz);
        u.lang = v ? v.lang : 'pt-BR';
        u.rate = 0.97 * ((voz && voz.speed) || 1);
        u.pitch = (voz && voz.pitch) || 1; // vem da prosódia da frase (tts/prosodia.js); a voz neural do Edge pode ignorar o tom
        if (v) u.voice = v;
        const aoAbortar = () => synth.cancel();
        const fim = () => { if (signal) signal.removeEventListener('abort', aoAbortar); resolver(); };
        if (signal) signal.addEventListener('abort', aoAbortar, { once: true });
        u.onboundary = () => { if (aoPalavra) aoPalavra(); };
        u.onend = fim;
        u.onerror = (ev) => {
          if (ev.error !== 'interrupted' && ev.error !== 'canceled') console.warn('[webspeech]', ev.error);
          fim();
        };
        synth.speak(u);
      });
    },
    parar() { if (synth) synth.cancel(); },
    // Safari e Chrome no iOS só liberam a fala depois de um speak() dentro de um gesto do usuário.
    preparar() { if (synth && !preparado) { preparado = true; synth.speak(new SpeechSynthesisUtterance('')); } },
    get vozes() { return vozes; },
    // Há voz neural pt-BR do Edge? (o modo Automático prefere essas vozes ao Kokoro)
    get temNatural() { return vozes.some((v) => /pt[-_]BR/i.test(v.lang) && /natural/i.test(v.name)); },
    vozPara,
    // '' volta para a escolha automática por personagem.
    escolherVoz(nome) {
      nomeManual = nome || '';
      manual = nomeManual ? vozes.find((v) => v.name === nomeManual) || null : null;
      gravar('voice', nomeManual);
    },
  };
}
