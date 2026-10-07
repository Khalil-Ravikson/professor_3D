// Diagnóstico do quiosque (P9): o que o operador precisa ver sem abrir o console.
// FPS, memória, latência, gasto, estado de cada serviço e os últimos erros.
//
// Nada aqui aparece para o público. O painel só atualiza enquanto está aberto:
// medir de graça o tempo todo tiraria quadro do personagem.

const MAX_ERROS = 20;
const MAX_LATENCIAS = 30;

const mediana = (v) => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};

export function criarDiagnostico({ cena, aoErro = () => {} } = {}) {
  const erros = [];
  const latencias = { pergunta: [], fala: [], transcricao: [] }; // ms: até o primeiro texto, até a primeira fala e (mãos-livres) fim da fala até o texto
  const inicio = Date.now();
  let ultimaContagem = { quadros: cena ? cena.quadros : 0, t: performance.now() };
  let fpsAtual = null;

  function registrarErro(origem, mensagem) {
    const e = { t: new Date().toISOString().slice(11, 19), origem, mensagem: String(mensagem).slice(0, 300) };
    erros.push(e);
    if (erros.length > MAX_ERROS) erros.shift();
    aoErro(e);
  }

  // Erros que ninguém trata caem aqui. Não derrubam a tela do público: viram linha
  // no painel do operador, que é quem pode fazer alguma coisa a respeito.
  const aoErroGlobal = (ev) => registrarErro('erro', ev.message || (ev.error && ev.error.message) || 'erro sem mensagem');
  const aoRejeicao = (ev) => registrarErro('promessa', (ev.reason && (ev.reason.message || ev.reason)) || 'promessa rejeitada');
  addEventListener('error', aoErroGlobal);
  addEventListener('unhandledrejection', aoRejeicao);

  function medirFps() {
    if (!cena) return null;
    const agora = performance.now(), dt = agora - ultimaContagem.t;
    if (dt < 400) return fpsAtual; // amostra curta demais dá número instável
    fpsAtual = +(((cena.quadros - ultimaContagem.quadros) * 1000) / dt).toFixed(1);
    ultimaContagem = { quadros: cena.quadros, t: agora };
    return fpsAtual;
  }

  return {
    registrarErro,
    registrarTranscricao(ms) { latencias.transcricao.push(ms); if (latencias.transcricao.length > MAX_LATENCIAS) latencias.transcricao.shift(); },
    // Chamado a cada pergunta: devolve uma função para marcar os tempos daquela pergunta.
    marcarPergunta() {
      const t0 = performance.now();
      let primeiroTexto = false, primeiraFala = false;
      return {
        aoPrimeiroTexto() {
          if (primeiroTexto) return;
          primeiroTexto = true;
          latencias.pergunta.push(Math.round(performance.now() - t0));
          if (latencias.pergunta.length > MAX_LATENCIAS) latencias.pergunta.shift();
        },
        aoPrimeiraFala() {
          if (primeiraFala) return;
          primeiraFala = true;
          latencias.fala.push(Math.round(performance.now() - t0));
          if (latencias.fala.length > MAX_LATENCIAS) latencias.fala.shift();
        },
      };
    },
    get erros() { return erros.slice(); },
    get latencias() { return { pergunta: [...latencias.pergunta], fala: [...latencias.fala] }; },
    medirFps,
    // Um retrato do estado agora. `servicos` vem da interface, que é quem sabe.
    retrato(servicos = {}) {
      const mem = performance.memory || null;
      const info = cena && cena.renderer ? cena.renderer.info : null;
      return {
        emPe: Math.round((Date.now() - inicio) / 1000),
        fps: medirFps(),
        contextoPerdido: cena ? cena.contextoPerdido : false,
        memoria: mem ? {
          usadaMb: +(mem.usedJSHeapSize / 1048576).toFixed(1),
          limiteMb: +(mem.jsHeapSizeLimit / 1048576).toFixed(1),
        } : null,
        gpu: info ? { geometrias: info.memory.geometries, texturas: info.memory.textures, chamadas: info.render.calls } : null,
        latencia: {
          perguntaMs: mediana(latencias.pergunta),
          falaMs: mediana(latencias.fala),
          transcricaoMs: mediana(latencias.transcricao),
          amostras: latencias.pergunta.length,
        },
        servicos,
        erros: erros.length,
        ultimoErro: erros.length ? erros[erros.length - 1] : null,
      };
    },
    parar() {
      removeEventListener('error', aoErroGlobal);
      removeEventListener('unhandledrejection', aoRejeicao);
    },
  };
}
