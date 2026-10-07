// Rastreamento do corpo ao vivo (prompt 7, V5). Liga a câmera SÓ por ação explícita, manda cada quadro ao worker (MediaPipe local), recebe
// só números, filtra, converte em rotações dos ossos do VRM e aplica por cima do clipe com um peso por parte do corpo.
// Privacidade: nenhum quadro é guardado, gravado ou enviado; o ImageBitmap é fechado no worker; ao desligar, as tracks e o worker param.
// Ordem por quadro (avatar.js): mixer.update, esta sobreposição (aplicar), vrm.update.
import * as THREE from 'three';
import { retargetCorpo, repousoDoModelo, qParaLocal, IDX } from './retarget.js';
import { criarFiltroDePontos, criarGanho, suavizarOsso } from './suavizacao.js';
import { criarCalibracao } from './calibracao.js';
import { criarGravador, criarRepetidor, lerSessao } from './gravador.js';

const PARTES = ['bracos', 'tronco'];
export const CONFIG_PADRAO = { espelho: true, qualidade: 'leve', fps: 24, pesos: { bracos: 1, tronco: 1 } };
const MODELO = { leve: 'pose_landmarker_lite.task', equilibrada: 'pose_landmarker_full.task' };
const ESPERA_SEM_QUADRO_MS = 400; // sem resultado novo por este tempo, a confiança vira zero

export function criarRastreadorCorpo({ obterAvatar, config = {}, aoEstado = () => {}, base = new URL('assets/vendor/mediapipe/', location.href).href }) {
  const cfg = { ...CONFIG_PADRAO, ...config, pesos: { ...CONFIG_PADRAO.pesos, ...(config.pesos || {}) } };
  let worker = null, stream = null, video = null, timer = null, estado = 'desligado', emVoo = false, ligado = false;
  const filtro = criarFiltroDePontos();
  const calibracao = criarCalibracao({ duracaoMs: 2000 });
  const gravador = criarGravador();
  const ganhos = Object.fromEntries(PARTES.map((p) => [p, criarGanho({ limiar: 0.5, quadros: 4, rampaMs: 300 })]));
  const alvos = new Map(), atuais = new Map(); // osso -> { q, parte, conf }
  const stats = { resultados: 0, janela: [], inferenciaMs: [], latenciaMs: null, fps: 0, delegado: null, modelo: null };
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

  // Entrada comum a worker e repetidor: pontos de mundo (33) e tempo.
  function processarPose(pose, tMs) {
    ultimoResultadoMs = performance.now();
    if (!pose) { for (const o of alvos.values()) o.conf = 0; return; }
    const lm = filtro.filtrar(pose, tMs / 1000);
    const m = modelo();
    const bruto = retargetCorpo(lm, { espelho: cfg.espelho, base: calibracao.base ? calibracao.base.tronco : null, repouso: m.repouso });
    for (const [osso, v] of Object.entries(bruto.ossos)) alvos.set(osso, { q: qParaLocal(v.q, m.vrm0), parte: v.parte, conf: v.confianca });
    if (calibracao.fazendo) {
      const ombros = Math.hypot(lm[IDX.ombroE].x - lm[IDX.ombroD].x, lm[IDX.ombroE].z - lm[IDX.ombroD].z);
      const r = calibracao.alimentar({ tronco: bruto.tronco.bruto, centro: [(lm[IDX.ombroE].x + lm[IDX.ombroD].x) / 2, (lm[IDX.quadrilE].y + lm[IDX.ombroE].y) / 2], escala: ombros }, performance.now());
      if (!r.fazendo) mudar(r.falhou ? 'rastreando' : 'rastreando', { calibrou: !!r.pronto, falhou: r.falhou });
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
    if (gravador.gravando) gravador.adicionar(m.t, m.pose || []);
    processarPose(m.pose, m.t);
    adaptar(agora);
  }

  // Qualidade adaptativa: inferência acima do orçamento do quadro reduz a taxa (depois os dedos e as pernas, quando existirem).
  function adaptar(agora) {
    if (agora - janelaT0 < 2000 || stats.inferenciaMs.length < 5) return;
    janelaT0 = agora;
    const v = stats.inferenciaMs.slice().sort((a, b) => a - b), med = v[v.length >> 1];
    if (med > (1000 / cfg.fps) * 0.9 && cfg.fps > 10) { cfg.fps = cfg.fps > 15 ? 15 : 10; mudar(estado, { aviso: `Rastreamento reduzido para ${cfg.fps} quadros por segundo (inferência de ${Math.round(med)} ms).`, sempre: true }); }
  }

  async function tick() {
    timer = null;
    if (!ligado) return;
    if (!document.hidden && video && video.readyState >= 2 && !emVoo && worker) {
      try { const bmp = await createImageBitmap(video); emVoo = true; worker.postMessage({ tipo: 'quadro', bitmap: bmp, t: performance.now() }, [bmp]); }
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
      w.postMessage({ tipo: 'iniciar', base, modelo: stats.modelo, maos: false });
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
      calibracao.iniciar(performance.now());
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
    filtro.zerar(); alvos.clear(); atuais.clear();
    for (const g of Object.values(ganhos)) g.zerar();
    mudar('desligado');
  }

  // Chamado por quadro de render, entre mixer.update e vrm.update.
  function aplicar(dt) {
    const av = obterAvatar();
    if (!av || !av.vrm || (!ligado && !repetidor)) return;
    const semDado = performance.now() - ultimoResultadoMs > ESPERA_SEM_QUADRO_MS;
    const confPorParte = {};
    for (const o of alvos.values()) confPorParte[o.parte] = Math.min(confPorParte[o.parte] ?? 1, semDado ? 0 : o.conf);
    let algum = false;
    for (const p of PARTES) {
      const peso = cfg.pesos[p] || 0;
      const g = ganhos[p].atualizar(peso > 0 ? (confPorParte[p] ?? 0) : 0, dt);
      if (g > 0.01) algum = true;
    }
    for (const [osso, o] of alvos) {
      const peso = (cfg.pesos[o.parte] || 0) * ganhos[o.parte].valor;
      if (peso <= 0.001) { atuais.delete(osso); continue; }
      const no = av.vrm.humanoid.getNormalizedBoneNode(osso);
      if (!no) continue;
      const atual = suavizarOsso(atuais.get(osso), o.q, dt);
      atuais.set(osso, atual);
      qTmp.set(atual[0], atual[1], atual[2], atual[3]);
      no.quaternion.slerp(qTmp, peso);
    }
    if (ligado && !calibracao.fazendo) {
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
    ligar, desligar, aplicar, processarPose,
    configurar(novo) { Object.assign(cfg, novo, { pesos: { ...cfg.pesos, ...(novo.pesos || {}) } }); },
    recalibrar() { calibracao.zerar(); calibracao.iniciar(performance.now()); if (ligado || repetidor) mudar('calibrando'); },
    gravarInicio() { gravador.iniciar(); },
    gravarFim() { gravador.parar(); return gravador.serializar(); },
    get gravando() { return gravador.gravando; },
    // Repete uma sessão de números (arquivo gravado antes) no mesmo caminho do ao vivo: regressão e ajuste sem webcam.
    repetir(texto, { aoFim = () => {} } = {}) {
      const quadros = lerSessao(texto);
      repetidor = criarRepetidor(quadros, (q) => { processarPose(q.pose, q.t); stats.resultados++; }, { aoFim: () => { aoFim(); } });
      calibracao.zerar(); mudar('rastreando');
      repetidor.iniciar();
    },
  };
}
