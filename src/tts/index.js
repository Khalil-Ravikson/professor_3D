// Adaptador de voz. Interface comum dos motores:
//   sintetizar(texto, voz, { signal, ctx }) -> Promise<AudioBuffer>   (motores com áudio)
//   falar(texto, voz, { signal, aoPalavra }) -> Promise<void>          (motor "direto": Web Speech)
// voz = { motor, id, speed } vinda do personagem.
//
// Um "turno" é uma resposta falada. As frases entram conforme o Gemini escreve;
// a síntese corre na frente (a frase N+1 é sintetizada enquanto a N toca) e a
// reprodução segue a ordem. parar() aborta HTTP, fila e áudio de uma vez.
import { criarKokoroServidor, normalizarUrl } from './kokoro-server.js';
import { criarKokoroNavegador } from './kokoro-browser.js';
import { criarWebSpeech } from './webspeech.js';
import { criarGeminiTts } from './gemini-motor.js';
import { dividirFrases, limparParaFala, normalizarParaFala } from './frases.js';
import { extrairGestos } from '../gestos.js';
import { extrairEmocao } from '../emocao.js';
import { removerMarcaFonte } from '../rag/prompt.js';
import { criarMesa, PAUSA_ENTRE_FRASES_MS } from '../audio.js';

function criarCanal() {
  const itens = [];
  let esperando = null, fechado = false;
  return {
    enviar(x) {
      if (fechado) return;
      if (esperando) { const r = esperando; esperando = null; r({ valor: x }); } else itens.push(x);
    },
    fechar() {
      fechado = true;
      if (esperando) { const r = esperando; esperando = null; r({ fim: true }); }
    },
    receber() {
      if (itens.length) return Promise.resolve({ valor: itens.shift() });
      if (fechado) return Promise.resolve({ fim: true });
      return new Promise((r) => { esperando = r; });
    },
  };
}

export function criarVoz({ config, volumeInicial, mudoInicial, aoMudarMesa, aoComecarFala, aoTerminarFala, aoFimFrase = () => {}, aoInicioFrase = () => {}, aoPalavra, aoStatus, aoMudarVozesSistema, aoProgressoNavegador }) {
  const ctx = new AudioContext();
  const saida = ctx.createGain();
  const analisador = ctx.createAnalyser();
  analisador.fftSize = 1024;
  saida.connect(analisador);
  analisador.connect(ctx.destination);
  const mesa = criarMesa({ ctx, saida, volumeInicial, mudoInicial, aoMudar: aoMudarMesa });

  const servidor = criarKokoroServidor({ obterUrl: () => config.urlKokoro });
  const navegador = criarKokoroNavegador({ aoProgresso: aoProgressoNavegador });
  const sistema = criarWebSpeech({ aoMudarVozes: aoMudarVozesSistema });
  // config.gemini = { chave, modelo, voz, estilo, aoMedir, disponivel() } vem da interface (ui.js).
  const gemini = criarGeminiTts({ obterConfig: () => config.gemini });
  let statusGemini = { ok: null, detalhe: 'não usado' };

  let statusServidor = { ok: null, detalhe: 'verificando' };
  let motorAtual = null, avisoAtual = null;
  let turno = null, seq = 0;
  const registro = []; // eventos com tempo, para testes e diagnóstico (últimos 300)
  // Frases fixas (cumprimento, despedida) já sintetizadas: tocam sem esperar o motor.
  // Chave: motor|voz|velocidade|texto. Limite pequeno: são poucas frases por personagem.
  const preSintetizadas = new Map();
  // A voz do Gemini entra na chave: Luma (Kore) e Teo (Puck) não podem repartir o mesmo áudio guardado.
  const chaveFrase = (motor, voz, texto) => `${motor.id}|${voz && voz.id}|${voz && voz.gemini && voz.gemini.voz}|${voz && voz.speed}|${texto}`;

  function anotar(tipo, dados = {}) {
    registro.push({ t: Math.round(performance.now()), tipo, ...dados });
    if (registro.length > 300) registro.shift();
  }

  function emitirStatus() {
    aoStatus({ motor: motorAtual, aviso: avisoAtual, servidor: statusServidor, preferencia: config.motor });
  }

  async function verificarServidor(opcoes) {
    statusServidor = await servidor.verificar(opcoes);
    anotar('servidor', { ok: statusServidor.ok });
    resolverMotor(null);
    emitirStatus();
    return statusServidor;
  }

  // Motor para a voz de um personagem. Kokoro servidor é o padrão; sem resposta, voz do sistema.
  function resolverMotor(voz) {
    let motor = sistema, aviso = null;
    const querNavegador = config.motor === 'kokoro-browser' || (voz && voz.motor === 'kokoro-browser');
    // Gemini TTS: vale enquanto houver chave, teto de caracteres e a última chamada não tiver falhado.
    // Senão cai para o Kokoro (ou a voz do sistema) e o aviso diz por quê.
    let reservaDoGemini = false;
    if (config.motor === 'gemini') {
      const g = config.gemini ? config.gemini.disponivel() : { ok: false, aviso: 'O Gemini TTS não está configurado. Usando outra voz.' };
      if (g.ok && statusGemini.ok !== false) {
        if (motorAtual !== gemini || avisoAtual !== null) { motorAtual = gemini; avisoAtual = null; emitirStatus(); }
        return gemini;
      }
      reservaDoGemini = true;
      aviso = g.ok ? 'O Gemini TTS falhou. Usando outra voz.' : g.aviso;
    }
    if (reservaDoGemini) {
      motor = statusServidor.ok ? servidor : sistema;
    } else if (config.motor === 'webspeech') {
      motor = sistema;
    } else if (config.motor === 'auto' && sistema.temNatural && !querNavegador) {
      // Edge com vozes neurais pt-BR: grátis e mais naturais que o Kokoro em português.
      motor = sistema;
    } else if (querNavegador) {
      if (!voz || navegador.suportaVoz(voz)) motor = navegador;
      else aviso = 'O Kokoro no navegador não tem vozes em português. Usando a voz do sistema.';
    } else if (statusServidor.ok) {
      motor = servidor;
    } else if (statusServidor.ok === false) {
      aviso = 'Servidor de voz fora do ar. Usando a voz do sistema.';
    }
    if (motor !== motorAtual || aviso !== avisoAtual) { motorAtual = motor; avisoAtual = aviso; emitirStatus(); }
    return motor;
  }

  // Cada frase passa por um ganho próprio, para que todas cheguem no mesmo volume.
  function tocarBuffer(t, buffer, rotulo) {
    return new Promise((resolver) => {
      const fonte = ctx.createBufferSource();
      fonte.buffer = buffer;
      const ganho = ctx.createGain();
      ganho.gain.value = mesa.normalizar(buffer, rotulo).ganho;
      fonte.connect(ganho);
      ganho.connect(saida);
      t.fonte = fonte;
      fonte.onended = () => { fonte.disconnect(); ganho.disconnect(); if (t.fonte === fonte) t.fonte = null; resolver(); };
      fonte.start();
    });
  }

  // Espera que parar() encerra na hora, para o intervalo entre sentenças não atrasar um corte.
  function esperar(t, ms) {
    if (t.cancelado) return Promise.resolve();
    return new Promise((resolver) => {
      const id = setTimeout(() => { t.timers.delete(cancelar); resolver(); }, ms);
      const cancelar = () => { clearTimeout(id); resolver(); };
      t.timers.add(cancelar);
    });
  }

  async function lacoSintese(t) {
    let n = 0, gestosSobrando = [], emocaoSobrando = null;
    for (;;) {
      const { valor, fim } = await t.frases.receber();
      if (fim || t.cancelado) break;
      const marcado = extrairGestos(valor);
      const emo = extrairEmocao(marcado.texto);
      const gestos = gestosSobrando.concat(marcado.gestos);
      const emocao = emo.emocao ?? emocaoSobrando;
      const texto = normalizarParaFala(limparParaFala(removerMarcaFonte(emo.texto))).trim();
      // Marca sozinha numa "sentença" vazia vai para a próxima sentença com fala.
      if (!texto) { gestosSobrando = gestos; emocaoSobrando = emocao; continue; }
      gestosSobrando = []; emocaoSobrando = null;
      const i = n++;
      const motor = resolverMotor(t.voz);
      if (motor.direto) { t.audios.enviar({ i, texto, motor, gestos, emocao }); continue; }
      const pronta = preSintetizadas.get(chaveFrase(motor, t.voz, texto));
      if (pronta) { anotar('sintese-cache', { turno: t.id, i }); t.audios.enviar({ i, texto, buffer: pronta, gestos, emocao }); continue; }
      anotar('sintese-inicio', { turno: t.id, i, motor: motor.id });
      try {
        const buffer = await motor.sintetizar(texto, t.voz, { signal: t.ctl.signal, ctx });
        if (t.cancelado) break;
        anotar('sintese-fim', { turno: t.id, i, duracao: +buffer.duration.toFixed(2) });
        t.audios.enviar({ i, texto, buffer, gestos, emocao });
      } catch (e) {
        if (t.cancelado || e.name === 'AbortError') { anotar('sintese-abortada', { turno: t.id, i }); break; }
        console.warn(`[voz] ${motor.id} falhou; esta frase vai pela voz do sistema:`, e);
        anotar('sintese-erro', { turno: t.id, i, motor: motor.id });
        if (motor === servidor) { statusServidor = { ok: false, detalhe: 'falhou ao sintetizar' }; resolverMotor(t.voz); }
        if (motor === gemini) { statusGemini = { ok: false, detalhe: e.status ? `HTTP ${e.status}` : 'falhou' }; resolverMotor(t.voz); }
        t.audios.enviar({ i, texto, motor: sistema, gestos, emocao });
      }
    }
    t.audios.fechar();
  }

  async function lacoReproducao(t) {
    for (;;) {
      const { valor: item, fim } = await t.audios.receber();
      if (fim || t.cancelado) break;
      if (!t.comecou) { t.comecou = true; aoComecarFala(); }
      // Intervalo curto e constante entre sentenças: antes de cada uma, menos da primeira,
      // para não somar atraso no fim da fala.
      else { await esperar(t, PAUSA_ENTRE_FRASES_MS); if (t.cancelado) break; }
      anotar('toca-inicio', { turno: t.id, i: item.i });
      if ((item.gestos && item.gestos.length) || item.emocao) aoInicioFrase(item.gestos || [], item.emocao);
      if (item.buffer) await tocarBuffer(t, item.buffer, item.texto.slice(0, 40));
      else await item.motor.falar(item.texto, t.voz, { signal: t.ctl.signal, aoPalavra });
      anotar('toca-fim', { turno: t.id, i: item.i, cancelado: !!t.cancelado });
      // Fronteira de sentença: único momento em que um gesto pendente pode começar.
      if (!t.cancelado) aoFimFrase(item.i);
    }
    if (turno === t) turno = null;
    if (!t.cancelado) { anotar('turno-fim', { turno: t.id }); aoTerminarFala(); }
  }

  function parar() {
    const t = turno;
    if (!t) return;
    turno = null;
    t.cancelado = true;
    t.ctl.abort();
    if (t.fonte) { try { t.fonte.stop(); } catch (e) { console.warn('[voz] stop() numa fonte já parada:', e); } }
    for (const cancelar of t.timers) cancelar();
    t.timers.clear();
    sistema.parar();
    t.frases.fechar();
    t.audios.fechar();
    anotar('parado', { turno: t.id });
  }

  function novoTurno(voz) {
    parar();
    const t = { id: ++seq, voz, ctl: new AbortController(), frases: criarCanal(), audios: criarCanal(), cancelado: false, comecou: false, fonte: null, timers: new Set() };
    turno = t;
    anotar('turno-inicio', { turno: t.id });
    lacoSintese(t);
    lacoReproducao(t);
    return {
      adicionar(frase) { if (!t.cancelado) t.frases.enviar(frase); },
      finalizar() { t.frases.fechar(); },
    };
  }

  return {
    ctx,
    saida,
    analisador,
    mesa,
    registro,
    get falando() { return !!(turno && turno.comecou); },
    get frasesProntas() { return preSintetizadas.size; },
    // Há um turno vivo (sintetizando ou tocando). Falso depois do fim ou de parar().
    get emTurno() { return !!turno; },
    get statusServidor() { return statusServidor; },
    sistema,
    gemini,
    get statusGemini() { return statusGemini; },
    // Depois de mudar chave, modelo ou voz nas configurações, tenta o Gemini de novo.
    reiniciarGemini() { statusGemini = { ok: null, detalhe: 'não usado' }; resolverMotor(null); },
    navegador,
    verificarServidor,
    resolverMotor,
    novoTurno,
    parar,
    // Sintetiza agora e guarda, para a frase tocar na hora quando for pedida.
    // Só vale para motores que devolvem áudio (Kokoro); a voz do sistema já fala direto.
    async preSintetizar(texto, voz) {
      const motor = resolverMotor(voz);
      if (motor.direto) return false;
      // Voz paga NUNCA pré-sintetiza sozinha: o cache é só de memória e se perde a cada carregamento,
      // então cada abertura da página gastaria crédito à toa. Pré-gravar com voz paga é uma ação deliberada
      // do operador (pacote de áudio, REPERTORIO seção 31), não efeito colateral de escolher o motor.
      if (motor === gemini) return false;
      let ok = true;
      for (const f of dividirFrases(texto)) {
        const limpo = normalizarParaFala(limparParaFala(f)).trim();
        const chave = chaveFrase(motor, voz, limpo);
        if (!limpo || preSintetizadas.has(chave)) continue;
        try {
          preSintetizadas.set(chave, await motor.sintetizar(limpo, voz, { ctx }));
          if (preSintetizadas.size > 40) preSintetizadas.delete(preSintetizadas.keys().next().value);
        } catch (e) {
          console.warn('[voz] não consegui pré-sintetizar; a frase será sintetizada na hora:', e);
          ok = false;
        }
      }
      return ok;
    },
    // O texto já está inteiro em cache de áudio? Só motores que devolvem áudio (Kokoro) guardam;
    // a voz do sistema fala direto e não tem arquivo para guardar.
    temPronta(texto, voz) {
      const motor = resolverMotor(voz);
      if (motor.direto) return false;
      const partes = dividirFrases(texto).map((f) => normalizarParaFala(limparParaFala(f)).trim()).filter(Boolean);
      return partes.length > 0 && partes.every((f) => preSintetizadas.has(chaveFrase(motor, voz, f)));
    },
    // Toca SÓ o que está em cache. Nunca sintetiza: é o que garante que o botão "Ouvir voz" não gasta
    // orçamento nem chama serviço pago. Devolve false (e não toca nada) se faltar qualquer frase.
    tocarPronta(texto, voz) {
      if (!this.temPronta(texto, voz)) return false;
      this.falarTexto(texto, voz);
      return true;
    },
    falarTexto(texto, voz) {
      const t = novoTurno(voz);
      for (const f of dividirFrases(texto)) t.adicionar(f);
      t.finalizar();
    },
    // Chamar dentro de um gesto do usuário (clique): libera o AudioContext e a Web Speech.
    preparar() {
      if (ctx.state === 'suspended') ctx.resume().catch((e) => console.warn('[voz] AudioContext.resume falhou:', e));
      sistema.preparar();
    },
    urlNormalizada: () => normalizarUrl(config.urlKokoro),
  };
}
