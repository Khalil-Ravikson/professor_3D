// Rastreamento do corpo ao vivo (prompt 7, V5). Liga a câmera SÓ por ação explícita, manda cada quadro ao worker (MediaPipe local), recebe
// só números, filtra, converte em rotações dos ossos do VRM e aplica por cima do clipe com um peso por parte do corpo.
// Privacidade: nenhum quadro é guardado, gravado ou enviado; o ImageBitmap é fechado no worker; ao desligar, as tracks e o worker param.
// Ordem por quadro (avatar.js): mixer.update, esta sobreposição (aplicar), vrm.update.
import * as THREE from 'three';
import { retargetCorpo, repousoDoModelo, qParaLocal, IDX } from './retarget.js';
import { criarFiltroDePontos, criarGanho, suavizarOsso } from './suavizacao.js';
import { criarCalibracao } from './calibracao.js';
import { criarGravador, criarRepetidor, lerSessao } from './gravador.js';
import { retargetMao, emparelharMaos, dirDaMao, ladoDaMao } from './maos.js';
import { criarMovimento, medidaDoCorpo } from './movimento.js';
import { criarDetectorGestos } from './gestos-usuario.js';

// Cada braço e cada mão têm o seu ganho: com uma mão fora do quadro (o normal numa webcam de mesa), o resto continua sendo rastreado.
const GRUPOS = ['bracoEsq', 'bracoDir', 'tronco', 'maoEsq', 'maoDir', 'movimento'];
const ehDedo = (osso) => /(Thumb|Index|Middle|Ring|Little)/.test(osso);
const grupoDe = (osso) => {
  const lado = osso.startsWith('left') ? 'Esq' : osso.startsWith('right') ? 'Dir' : null;
  if (!lado) return 'tronco';
  return ehDedo(osso) ? `mao${lado}` : `braco${lado}`;
};
const parteDoGrupo = (g) => (g === 'tronco' ? 'tronco' : g === 'movimento' ? 'movimento' : g.startsWith('mao') ? 'maos' : 'bracos');
// fluido: filtro nos pontos da mão, tolerância a quadros sem mão, lado estável, suavização rápida nos dedos e pulso pela própria mão (false = como era antes, para comparar).
export const CONFIG_PADRAO = { espelho: true, qualidade: 'leve', fps: 24, gestos: true, fluido: true, maosACada: 1, pesos: { bracos: 1, tronco: 1, maos: 1, movimento: 1 } };
const MODELO = { leve: 'pose_landmarker_lite.task', equilibrada: 'pose_landmarker_full.task' };
const ESPERA_SEM_QUADRO_MS = 400;
const GRACA_MAO_MS = 350; // mão que some por menos que isso continua valendo (a detecção pisca)
const PARAM_DEDO = { fluido: { velMax: 24, tau: 0.03 }, antigo: { velMax: 8, tau: 0.06 } }; // sem resultado novo por este tempo, a confiança vira zero

export function criarRastreadorCorpo({ obterAvatar, config = {}, aoEstado = () => {}, aoGesto = () => {}, base = new URL('assets/vendor/mediapipe/', location.href).href }) {
  const cfg = { ...CONFIG_PADRAO, ...config, pesos: { ...CONFIG_PADRAO.pesos, ...(config.pesos || {}) } };
  let worker = null, stream = null, video = null, timer = null, estado = 'desligado', emVoo = false, ligado = false;
  const filtro = criarFiltroDePontos();
  const calibracao = criarCalibracao({ duracaoMs: 2000 });
  const gravador = criarGravador();
  const detector = criarDetectorGestos();
  const movimento = criarMovimento();
  let movAlvo = { x: 0, z: 0 }, movConf = 0, ultimoT = null, cenaRepouso = null;
  const ganhos = Object.fromEntries(GRUPOS.map((g) => [g, g.startsWith('mao') && cfg.fluido ? criarGanho({ limiar: 0.5, quadros: 8, rampaMs: 150 }) : criarGanho({ limiar: 0.5, quadros: 4, rampaMs: 300 })]));
  // Mãos: filtro por lado, última mão vista (para tolerar quadros sem detecção) e onde estava cada pulso (lado estável).
  const maosFiltro = { esq: criarFiltroDePontos({ minCutoff: 1.2, beta: 0.08 }), dir: criarFiltroDePontos({ minCutoff: 1.2, beta: 0.08 }) };
  const maosVistas = { esq: { lm: null, t: 0 }, dir: { lm: null, t: 0 } };
  let pulsosAnteriores = null, contadorQuadros = 0;
  const alvos = new Map(), atuais = new Map(); // osso -> { q, parte, conf }
  const originais = new Map(); // osso -> quaternion de antes da sobreposição neste quadro (desfeito antes do mixer do quadro seguinte)
  let baseRepeticao = null, esperandoCorpo = false;
  const stats = { calibragem: 0, calibrando: false, parado: true, confianca: {}, resultados: 0, janela: [], inferenciaMs: [], latenciaMs: null, fps: 0, delegado: null, modelo: null };
  let ultimoResultadoMs = 0, tUltimoResultadoCaptura = 0, repetidor = null, janelaT0 = 0;
  const qTmp = new THREE.Quaternion();
  // Direção de repouso de cada segmento, lida do próprio modelo (braço em T ou em A, VRM 0.x com x e z invertidos). Uma vez por avatar.
  let modeloCache = null;
  function modelo() {
    const av = obterAvatar();
    if (!av || !av.vrm) return { repouso: null, vrm0: false };
    if (!modeloCache || modeloCache.vrm !== av.vrm) {
      const vrm0 = !!(av.vrm.meta && av.vrm.meta.metaVersion === '0');
      const posicao = (nome) => { const no = av.vrm.humanoid.getNormalizedBoneNode(nome); return no ? [no.position.x, no.position.y, no.position.z] : null; };
      modeloCache = { vrm: av.vrm, vrm0, repouso: repousoDoModelo(posicao, { vrm0 }) };
    }
    return modeloCache;
  }

  const mudar = (novo, extra = {}) => { if (estado !== novo || extra.sempre) { estado = novo; } aoEstado({ estado, ...extra, stats: { ...stats, janela: undefined, inferenciaMs: undefined } }); };

  // Entrada comum a worker e repetidor: pontos de mundo (33), tempo, mãos { esq, dir } da PESSOA (mundo, 21) e pose normalizada.
  function processarPose(pose, tMs, maos = null, norm = null, maosNovas = true) {
    ultimoResultadoMs = performance.now();
    const dt = ultimoT === null ? 1 / 30 : Math.max(0.001, Math.min(0.5, (tMs - ultimoT) / 1000));
    ultimoT = tMs;
    if (!pose) { for (const o of alvos.values()) o.conf = 0; movConf = 0; movAlvo = { x: 0, z: 0 }; detector.zerar(); return; }
    const lm = filtro.filtrar(pose, tMs / 1000);
    const m = modelo();
    // Mãos deste quadro (da PESSOA): filtradas, e a última vista segue valendo por GRACA_MAO_MS se a detecção piscar ou o quadro não rodou as mãos.
    const maosUsar = { esq: null, dir: null };
    for (const lado of ['esq', 'dir']) {
      const nova = maosNovas && maos && maos[lado] ? maos[lado] : null;
      if (!cfg.fluido) { maosUsar[lado] = nova; continue; }
      const v = maosVistas[lado];
      if (nova) { v.lm = maosFiltro[lado].filtrar(nova, tMs / 1000); v.t = tMs; }
      else if (v.lm && tMs - v.t > 1000) { maosFiltro[lado].zerar(); v.lm = null; }
      maosUsar[lado] = v.lm && tMs - v.t <= GRACA_MAO_MS ? v.lm : null;
    }
    const dirMaos = cfg.fluido ? { esq: dirDaMao(maosUsar.esq), dir: dirDaMao(maosUsar.dir), ladoEsq: ladoDaMao(maosUsar.esq), ladoDir: ladoDaMao(maosUsar.dir) } : null;
    const bruto = retargetCorpo(lm, { espelho: cfg.espelho, base: calibracao.base ? calibracao.base.tronco : null, repouso: m.repouso, dirMaos });
    for (const [osso, v] of Object.entries(bruto.ossos)) alvos.set(osso, { q: qParaLocal(v.q, m.vrm0), parte: v.parte, conf: v.confianca });
    // Dedos: a mão DIREITA da pessoa vai para a esquerda do avatar no espelho (como os braços). Mão ausente: confiança zero naquele lado.
    for (const lado of ['esq', 'dir']) {
      const ladoAvatar = cfg.espelho ? (lado === 'esq' ? 'dir' : 'esq') : lado;
      const prefixo = ladoAvatar === 'esq' ? 'left' : 'right';
      if (maosUsar[lado]) {
        for (const [osso, q] of Object.entries(retargetMao(maosUsar[lado], ladoAvatar))) alvos.set(osso, { q: qParaLocal(q, m.vrm0), parte: 'maos', conf: 1 });
      } else {
        for (const [osso, o] of alvos) if (osso.startsWith(prefixo) && ehDedo(osso)) o.conf = 0;
      }
    }
    // Movimento do corpo: posição e escala dos ombros na imagem, contra a base da calibração.
    const med = norm ? medidaDoCorpo(norm) : null;
    movConf = med ? med.vis : 0;
    if (repetidor && !baseRepeticao && med) baseRepeticao = { centro: med.centro, escala: med.escala }; // repetição sem calibração: o primeiro quadro é a base
    const mv = movimento.calcular(norm, calibracao.base || (repetidor ? baseRepeticao : null), cfg.espelho, dt);
    movAlvo = { x: mv.x, z: mv.z };
    if (cfg.gestos) for (const ev of detector.alimentar({ t: tMs, norm, maos })) aoGesto(ev);
    const amostra = { tronco: bruto.tronco.bruto, centro: med ? med.centro : [0.5, 0.5], escala: med ? med.escala : 0.3 };
    const corpoVisivel = bruto.tronco.confianca >= 0.6 && !!med;
    if (esperandoCorpo && corpoVisivel) { esperandoCorpo = false; calibracao.iniciar(performance.now()); }
    if (calibracao.fazendo) {
      if (corpoVisivel) {
        const r = calibracao.alimentar(amostra, performance.now());
        stats.calibragem = r.progresso; stats.parado = r.parado; stats.calibrando = r.fazendo;
        if (!r.fazendo) { stats.calibragem = r.pronto ? 1 : 0; mudar('rastreando', { calibrou: !!r.pronto, falhou: r.falhou }); }
      }
    } else if (calibracao.base && corpoVisivel && cfg.fluido) {
      calibracao.refinar(amostra); // a postura de repouso muda com o cansaço: a base acompanha, devagar
    }
  }

  function aoResultado(m) {
    emVoo = false;
    stats.resultados++;
    const agora = performance.now();
    stats.janela.push(agora); stats.inferenciaMs.push(m.ms);
    while (stats.janela.length && agora - stats.janela[0] > 2000) { stats.janela.shift(); stats.inferenciaMs.shift(); }
    stats.fps = +(stats.janela.length / 2).toFixed(1);
    tUltimoResultadoCaptura = m.t;
    const novas = m.maosAtualizadas !== false; // false: este quadro não rodou as mãos
    const maos = novas ? emparelharMaos(m.maos, m.normalizado, { anterior: cfg.fluido ? pulsosAnteriores : null }) : null;
    if (novas && cfg.fluido) pulsosAnteriores = maos.pulsos;
    if (gravador.gravando) gravador.adicionar(m.t, m.pose || [], maos || { esq: null, dir: null }, m.normalizado);
    processarPose(m.pose, m.t, maos, m.normalizado, novas);
    adaptar(agora);
  }

  // Qualidade adaptativa: inferência acima do orçamento do quadro reduz a taxa (depois os dedos e as pernas, quando existirem).
  function adaptar(agora) {
    if (agora - janelaT0 < 2000 || stats.inferenciaMs.length < 5) return;
    janelaT0 = agora;
    const v = stats.inferenciaMs.slice().sort((a, b) => a - b), med = v[v.length >> 1];
    if (med <= (1000 / cfg.fps) * 0.9) return;
    if (cfg.fps > 10) { cfg.fps = cfg.fps > 15 ? 15 : 10; mudar(estado, { aviso: `Rastreamento reduzido para ${cfg.fps} quadros por segundo (inferência de ${Math.round(med)} ms).`, sempre: true }); }
    else if (cfg.maosACada < 3 && cfg.pesos.maos > 0) { cfg.maosACada++; mudar(estado, { aviso: `Mãos a cada ${cfg.maosACada} quadros para aliviar o computador.`, sempre: true }); }
    else if (cfg.pesos.maos > 0) { cfg.pesos.maos = 0; mudar(estado, { aviso: 'Dedos desligados: o computador não acompanha.', sempre: true }); } // ordem do prompt: taxa, dedos, depois movimento
    else if (cfg.pesos.movimento > 0) { cfg.pesos.movimento = 0; mudar(estado, { aviso: 'Movimento do corpo desligado: o computador não acompanha.', sempre: true }); }
  }

  async function tick() {
    timer = null;
    if (!ligado) return;
    if (!document.hidden && video && video.readyState >= 2 && !emVoo && worker) {
      try { const bmp = await createImageBitmap(video); emVoo = true; worker.postMessage({ tipo: 'quadro', bitmap: bmp, t: performance.now(), maos: (contadorQuadros++ % Math.max(1, cfg.maosACada)) === 0 }, [bmp]); }
      catch (e) { console.warn('[corpo] não consegui capturar o quadro:', e); }
    }
    if (ligado) timer = setTimeout(tick, 1000 / cfg.fps);
  }

  function criarWorker() {
    // Worker CLÁSSICO: o MediaPipe usa importScripts (ver worker-corpo.js).
    const w = new Worker(new URL('./worker-corpo.js', import.meta.url));
    return new Promise((resolver, rejeitar) => {
      const limite = setTimeout(() => rejeitar(new Error('O rastreamento não carregou a tempo.')), 60000);
      w.onmessage = (e) => {
        const m = e.data;
        if (m.tipo === 'pronto') { clearTimeout(limite); stats.delegado = m.delegado; w.onmessage = (x) => { if (x.data.tipo === 'resultado') aoResultado(x.data); else if (x.data.tipo === 'erro') console.warn('[corpo] worker:', x.data.mensagem); }; resolver(w); }
        else if (m.tipo === 'erro') { clearTimeout(limite); rejeitar(new Error(m.mensagem)); }
      };
      w.onerror = (e) => { clearTimeout(limite); rejeitar(new Error(`worker: ${e.message}`)); };
      stats.modelo = MODELO[cfg.qualidade] || MODELO.leve;
      w.postMessage({ tipo: 'iniciar', base, modelo: stats.modelo, maos: cfg.pesos.maos > 0 || !!cfg.gestos });
    });
  }

  async function ligar({ fonteVideo = null } = {}) {
    if (ligado) return;
    ligado = true; mudar('ligando');
    try {
      if (fonteVideo) video = fonteVideo; // reaproveita a câmera do rosto, se já estiver ligada
      else {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
        video = document.createElement('video');
        video.muted = true; video.playsInline = true; video.srcObject = stream;
        await video.play();
      }
      worker = await criarWorker();
      esperandoCorpo = true; // a calibração começa quando o corpo aparece e só conta com a pessoa parada
      mudar('calibrando');
      tick();
    } catch (e) {
      console.error('[corpo] não ligou:', e);
      desligar();
      mudar('erro', { motivo: e.name === 'NotAllowedError' ? 'permissão negada' : e.name === 'NotFoundError' ? 'nenhuma câmera encontrada' : e.message });
    }
  }

  function desligar() {
    ligado = false; emVoo = false;
    clearTimeout(timer); timer = null;
    if (repetidor) { repetidor.cancelar(); repetidor = null; }
    if (worker) { worker.postMessage({ tipo: 'fechar' }); worker.terminate(); worker = null; }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (video && stream) { video.pause(); video.srcObject = null; }
    stream = null; video = null;
    restaurar(); baseRepeticao = null; esperandoCorpo = false; pulsosAnteriores = null;
    for (const l of ['esq', 'dir']) { maosFiltro[l].zerar(); maosVistas[l].lm = null; }
    stats.calibragem = 0; stats.calibrando = false;
    filtro.zerar(); alvos.clear(); atuais.clear(); detector.zerar(); movimento.zerar(); movAlvo = { x: 0, z: 0 }; movConf = 0; ultimoT = null;
    const av = obterAvatar();
    if (av && av.vrm && cenaRepouso && cenaRepouso.vrm === av.vrm) { av.vrm.scene.position.x = cenaRepouso.x; av.vrm.scene.position.z = cenaRepouso.z; }
    for (const g of Object.values(ganhos)) g.zerar();
    mudar('desligado');
  }

  // Chamado antes do mixer a cada quadro: devolve cada osso tocado ao valor anterior. O clipe sobrescreve o que anima; o que ele não anima
  // (os dedos) volta ao repouso, em vez de ficar preso na última dobra quando o rastreamento solta.
  function restaurar() {
    const av = obterAvatar();
    if (!av || !av.vrm) { originais.clear(); return; }
    for (const [osso, q] of originais) { const no = av.vrm.humanoid.getNormalizedBoneNode(osso); if (no) no.quaternion.copy(q); }
    originais.clear();
  }

  // Chamado por quadro de render, entre mixer.update e vrm.update.
  function aplicar(dt) {
    const av = obterAvatar();
    if (!av || !av.vrm || (!ligado && !repetidor)) return;
    const semDado = performance.now() - ultimoResultadoMs > ESPERA_SEM_QUADRO_MS;
    const conf = {};
    for (const [osso, o] of alvos) { const g = grupoDe(osso); conf[g] = Math.min(conf[g] ?? 1, semDado ? 0 : o.conf); }
    let algum = false;
    conf.movimento = semDado ? 0 : movConf;
    for (const g of GRUPOS) {
      const peso = cfg.pesos[parteDoGrupo(g)] || 0;
      const v = ganhos[g].atualizar(peso > 0 ? (conf[g] ?? 0) : 0, dt);
      if (v > 0.01) algum = true;
      stats.confianca[g] = +(conf[g] ?? 0).toFixed(2);
    }
    for (const [osso, o] of alvos) {
      const g = grupoDe(osso);
      const peso = (cfg.pesos[o.parte] || 0) * ganhos[g].valor;
      if (peso <= 0.001) { atuais.delete(osso); continue; }
      const no = av.vrm.humanoid.getNormalizedBoneNode(osso);
      if (!no) continue;
      originais.set(osso, no.quaternion.clone());
      const atual = suavizarOsso(atuais.get(osso), o.q, dt, ehDedo(osso) ? (cfg.fluido ? PARAM_DEDO.fluido : PARAM_DEDO.antigo) : undefined);
      atuais.set(osso, atual);
      qTmp.set(atual[0], atual[1], atual[2], atual[3]);
      no.quaternion.slerp(qTmp, peso);
    }
    // Movimento do corpo: desloca a cena do avatar (a cena não é tocada por clipe nem por "fixar no lugar", então o valor é absoluto, sem acumular).
    const cena = av.vrm.scene;
    if (!cenaRepouso || cenaRepouso.vrm !== av.vrm) cenaRepouso = { vrm: av.vrm, x: cena.position.x, z: cena.position.z };
    const gm = (cfg.pesos.movimento || 0) * ganhos.movimento.valor;
    cena.position.x = cenaRepouso.x + movAlvo.x * gm;
    cena.position.z = cenaRepouso.z + movAlvo.z * gm;
    if (ligado && !calibracao.fazendo && !esperandoCorpo) {
      const novo = algum ? 'rastreando' : 'perdeu';
      if (novo !== estado && estado !== 'ligando' && estado !== 'erro') mudar(novo);
    }
    if (tUltimoResultadoCaptura) stats.latenciaMs = Math.round(performance.now() - tUltimoResultadoCaptura);
  }

  return {
    get estado() { return estado; },
    get config() { return cfg; },
    get stats() { return stats; },
    get ligado() { return ligado; },
    get calibracao() { return calibracao.base; },
    get tracksAtivas() { return stream ? stream.getTracks().filter((t) => t.readyState === 'live').length : 0; },
    ligar, desligar, aplicar, restaurar, processarPose,
    configurar(novo) { Object.assign(cfg, novo, { pesos: { ...cfg.pesos, ...(novo.pesos || {}) } }); },
    recalibrar() { calibracao.zerar(); stats.calibragem = 0; esperandoCorpo = true; if (ligado || repetidor) mudar('calibrando'); },
    gravarInicio() { gravador.iniciar(); },
    gravarFim() { gravador.parar(); return gravador.serializar(); },
    get gravando() { return gravador.gravando; },
    // Repete uma sessão de números (arquivo gravado antes) no mesmo caminho do ao vivo: regressão e ajuste sem webcam.
    repetir(texto, { aoFim = () => {} } = {}) {
      const quadros = lerSessao(texto);
      repetidor = criarRepetidor(quadros, (q) => { processarPose(q.pose, q.t, q.maos, q.norm); stats.resultados++; }, { aoFim: () => { aoFim(); } });
      calibracao.zerar(); mudar('rastreando');
      repetidor.iniciar();
    },
  };
}
