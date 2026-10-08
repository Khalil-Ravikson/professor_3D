import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { criarLuzes, apontarCamera } from './scene.js';
import { EXPRESSOES, normalizarEmocao } from './emocao.js';
import { loadMixamoAnimation } from './vendor/mixamo/loadMixamoAnimation.js';

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
const loaderVrma = new GLTFLoader();
loaderVrma.register((parser) => new VRMAnimationLoaderPlugin(parser));

const LIMITE_MB = 20;

export class AvatarAusenteError extends Error {
  constructor(caminho, status) {
    super(`Arquivo não encontrado: ${caminho} (HTTP ${status})`);
    this.name = 'AvatarAusenteError';
    this.caminho = caminho;
  }
}

export class AvatarInvalidoError extends Error {
  constructor(caminho, causa) {
    super(`Não consegui abrir ${caminho}: ${causa && causa.message ? causa.message : causa}`);
    this.name = 'AvatarInvalidoError';
    this.caminho = caminho;
    this.cause = causa;
  }
}

// Só aceita .vrm. Não existe avatar reserva: quem chama mostra a tela de erro.
export async function carregarVrm(caminho, { signal, aoProgresso = null } = {}) {
  const resp = await fetch(caminho, { signal });
  if (!resp.ok) throw new AvatarAusenteError(caminho, resp.status);
  const buf = await lerComProgresso(resp, aoProgresso);

  let gltf;
  try {
    const base = caminho.slice(0, caminho.lastIndexOf('/') + 1);
    gltf = await loader.parseAsync(buf, base);
  } catch (e) {
    throw new AvatarInvalidoError(caminho, e);
  }
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new AvatarInvalidoError(caminho, new Error('o arquivo é glTF, mas não tem extensão VRM'));

  // Mesma sequência do exemplo oficial basic.html do three-vrm 3.5.5.
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.combineMorphs(vrm);
  VRMUtils.rotateVRM0(vrm); // só gira quando meta.metaVersion === '0'
  // createVRMAnimationClip pede este proxy quando o clipe pode ter trilha de olhar; sem ele o three-vrm-animation
  // cria um sozinho e avisa no console a cada clipe. Criar uma vez por modelo, como no exemplo oficial.
  // Os nossos clipes não trazem trilha de olhar, então o proxy fica em repouso: o olhar continua com o nosso lookAt.
  if (vrm.lookAt && !vrm.scene.getObjectByName('lookAtQuaternionProxy')) {
    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'lookAtQuaternionProxy';
    vrm.scene.add(proxy);
  }
  vrm.scene.traverse((o) => { o.frustumCulled = false; });

  return { vrm, bytes: buf.byteLength };
}

// Lê a resposta em pedaços para informar o progresso real (bytes recebidos / Content-Length).
// Sem Content-Length ou sem stream, lê de uma vez e informa só o fim.
async function lerComProgresso(resp, aoProgresso) {
  const total = Number(resp.headers.get('Content-Length')) || 0;
  if (!aoProgresso || !total || !resp.body) {
    const b = await resp.arrayBuffer();
    if (aoProgresso) aoProgresso(1);
    return b;
  }
  const saida = new Uint8Array(total);
  const leitor = resp.body.getReader();
  let recebido = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    saida.set(value, recebido);
    recebido += value.length;
    aoProgresso(Math.min(1, recebido / total));
  }
  return saida.buffer.slice(0, recebido);
}

export function descartarVrm(vrm) {
  if (vrm.scene.parent) vrm.scene.parent.remove(vrm.scene);
  VRMUtils.deepDispose(vrm.scene);
}

// HEAD no arquivo. Devolve uma "versão" (tamanho + data) para invalidar a miniatura
// em cache quando o .vrm for trocado, ou null se o arquivo não existe.
export async function verificarArquivo(caminho) {
  const versaoDe = (r) => `${r.headers.get('content-length')}|${r.headers.get('last-modified')}`;
  try {
    const r = await fetch(caminho, { method: 'HEAD' });
    return r.ok ? versaoDe(r) : null;
  } catch (e) {
    // Sem rede (totem offline): o arquivo guardado pelo service worker responde por ele.
    if (window.caches) {
      const guardado = await caches.match(new URL(caminho, location.href).href);
      if (guardado) return versaoDe(guardado);
    }
    console.warn(`[avatar] não consegui verificar ${caminho}:`, e);
    return null;
  }
}

// Miniatura do rosto a partir do próprio .vrm, com renderer próprio que é
// liberado no fim. O modelo fica em memória só durante a captura.
export async function gerarMiniatura(caminho, animacoes, tamanho = 160) {
  const { vrm } = await carregarVrm(caminho);
  const clipes = await carregarClipes({ idle: animacoes && animacoes.idle }, vrm);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(tamanho, tamanho, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    criarLuzes(scene);
    const av = montarAvatar(vrm, { scene }, { bases: clipes });
    av.atualizar(0, 0);

    // Altura da cabeça = do osso head até o topo do modelo; a câmera se afasta
    // na mesma proporção, então cabeças grandes e pequenas saem do mesmo tamanho.
    const topo = new THREE.Box3().setFromObject(vrm.scene).max.y;
    const alturaCabeca = Math.max(0.15, topo - av.posicaoCabeca.y);
    const foco = av.posicaoCabeca.clone();
    foco.y += alturaCabeca * 0.42;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
    apontarCamera(camera, foco, alturaCabeca * 3.4, 0);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/webp', 0.85);
    av.descartar();
    return url;
  } catch (e) {
    descartarVrm(vrm);
    throw e;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

// Checklist da seção 2 do REPERTORIO.
export function checarVrm(vrm, bytes) {
  const em = vrm.expressionManager;
  const tem = (n) => !!(em && em.getExpression(n));
  const faltando = (lista) => lista.filter((n) => !tem(n));
  const faltaOsso = ['head', 'neck', 'leftUpperArm', 'rightUpperArm']
    .filter((n) => !vrm.humanoid || !vrm.humanoid.getRawBoneNode(n));
  const mb = bytes / 1048576;
  return {
    versao: vrm.meta && vrm.meta.metaVersion === '0' ? '0.x' : '1.0',
    faltaVisema: faltando(['aa', 'ih', 'ou', 'ee', 'oh', 'blink']),
    // VRM 0.x não tem preset "surprised"; nesse caso a reação usa outra expressão.
    faltaEmocao: faltando(['happy', 'sad', 'surprised', 'relaxed', 'angry']),
    faltaOsso,
    mb: Math.round(mb * 10) / 10,
    grande: mb > LIMITE_MB,
  };
}

export function registrarChecklist(nome, c) {
  const ok = (lista) => (lista.length ? 'faltam ' + lista.join(', ') : 'ok');
  console.info(
    `[vrm] ${nome}: VRM ${c.versao}, ${c.mb} MB${c.grande ? ' (acima de 20 MB)' : ''} | ` +
    `visemas ${ok(c.faltaVisema)} | emoções ${ok(c.faltaEmocao)} | ossos ${ok(c.faltaOsso)}`
  );
}

/* ---------- Animações VRMA ---------- */
// Os .vrma servem para qualquer VRM; ficam em cache e cada avatar cria o próprio clipe.
const cacheVrma = new Map();

export function carregarVrma(nome) {
  if (!cacheVrma.has(nome)) {
    // Nome curto (idle) vira assets/animations/idle.vrma; caminho, .vrma ou blob: é usado como está.
    const url = /[/.:]/.test(nome) ? nome : `assets/animations/${nome}.vrma`;
    cacheVrma.set(nome, loaderVrma.loadAsync(url)
      .then((gltf) => gltf.userData.vrmAnimations && gltf.userData.vrmAnimations[0])
      .catch((e) => {
        console.warn(`[vrma] não consegui carregar ${url}; esse estado usa o idle:`, e);
        return null;
      }));
  }
  return cacheVrma.get(nome);
}

// animacoes: { idle: 'idle', talk: 'talk', ... } do personagem; valor ausente = sem clipe.
export async function carregarClipes(animacoes, vrm) {
  const clipes = {};
  for (const [estado, nome] of Object.entries(animacoes || {})) {
    if (!nome) continue;
    const anim = await carregarVrma(nome);
    if (anim) clipes[estado] = createVRMAnimationClip(anim, vrm);
  }
  return clipes;
}

// Movimentos enviados pelo painel: "enviado:<id>" -> { url (blob:), tipo: 'fbx' | 'vrma' }.
const enviados = new Map();
export function registrarEnviado(id, url, tipo) { enviados.set('enviado:' + id, { url, tipo }); }
export function esquecerEnviado(id) {
  const e = enviados.get('enviado:' + id);
  if (e) URL.revokeObjectURL(e.url);
  enviados.delete('enviado:' + id);
  cacheVrma.delete(e && e.url);
}

// Um clipe a partir do .vrma (caminho ou enviado) ou do .fbx do Mixamo enviado, já ajustado a este vrm.
// null se não abrir; o motivo vai para o console.
const clipesPorVrm = new WeakMap();
async function criarClipe(arquivo, vrm) {
  const env = enviados.get(arquivo);
  if (env && env.tipo === 'fbx') {
    try {
      return await loadMixamoAnimation(env.url, vrm);
    } catch (e) {
      console.warn(`[mixamo] não consegui converter ${arquivo}:`, e);
      return null;
    }
  }
  const anim = await carregarVrma(env ? env.url : arquivo);
  return anim ? createVRMAnimationClip(anim, vrm) : null;
}
export async function clipeDoArquivo(arquivo, vrm) {
  if (!clipesPorVrm.has(vrm)) clipesPorVrm.set(vrm, new Map());
  const cache = clipesPorVrm.get(vrm);
  if (!cache.has(arquivo)) cache.set(arquivo, criarClipe(arquivo, vrm));
  return cache.get(arquivo);
}

// Estado da interface (ui.js) -> estado-base do corpo.
const BASE_DO_ESTADO = { idle: 'idle', listening: 'listening', thinking: 'thinking', speaking: 'talking' };
const FADE_S = 0.3;

/* ---------- Avatar em cena ---------- */
// Corpo só por VRMA. bases: { idle, listening, thinking, talking } -> AnimationClip (estado sem clipe usa o idle;
// sem idle, o modelo fica na pose de descanso do arquivo). Gestos chegam por tocarGesto(clipe), decididos em gestos.js.
// Rosto: piscada, olhar (vrm.lookAt) e boca (pesos vindos de lipsync.js). Nenhum clipe do catálogo tem trilha
// de olhar nem de expressão, então o olhar é sempre do vrm.lookAt e a boca é sempre do lip sync.
export function montarAvatar(vrm, cena, { bases = {}, tetoBoca = {}, fixarNoLugar = () => true } = {}) {
  cena.scene.add(vrm.scene);
  const em = vrm.expressionManager;
  const hum = vrm.humanoid;

  const mixer = new THREE.AnimationMixer(vrm.scene);
  // Fixar no lugar: depois do mixer, o quadril volta ao X/Z de descanso. A altura fica com o clipe
  // (agachar continua agachando) e a rotação também (o giro continua girando, só que no mesmo ponto).
  const quadrilNorm = hum.getNormalizedBoneNode('hips');
  // O ponto fixo é onde o primeiro quadro do idle deixa o quadril (preenchido logo abaixo, antes de medir
  // a cabeça para a câmera). A pose de descanso do arquivo não serve: o idle tira o quadril dela
  // e a câmera, apontada com o idle aplicado, deixava o rosto fora do lugar (achado no teste M6.2).
  const quadrilDescanso = new THREE.Vector3();
  const acoesBase = {};
  for (const [estado, clipe] of Object.entries(bases)) if (clipe) acoesBase[estado] = mixer.clipAction(clipe);
  let acaoAtual = null, estadoBase = null, gesto = null, aoFimGesto = null;

  function trocarPara(alvo) {
    if (!alvo || alvo === acaoAtual) return;
    alvo.reset().setEffectiveWeight(1).fadeIn(acaoAtual ? FADE_S : 0).play();
    if (acaoAtual) acaoAtual.fadeOut(FADE_S);
    acaoAtual = alvo;
  }
  function tocarBase(estado) {
    estadoBase = estado;
    trocarPara(acoesBase[estado] || acoesBase.idle);
  }
  // Emoção (R2): pesos baixos que seguem o alvo com suavidade; só entram as expressões que o modelo tem.
  const emoAlvo = {}, emoAtual = { happy: 0, relaxed: 0, surprised: 0, sad: 0 };
  const emoTem = {};
  if (em) for (const k of Object.keys(emoAtual)) emoTem[k] = !!em.getExpression(k);
  function definirEmocao(nome) {
    for (const k of Object.keys(emoAtual)) emoAlvo[k] = 0;
    for (const [k, w] of Object.entries(EXPRESSOES[normalizarEmocao(nome)] || {})) emoAlvo[k] = w;
  }

  function tocarGesto(clipe, aoFim) {
    if (previa) return false;
    const a = mixer.clipAction(clipe);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    gesto = a; aoFimGesto = aoFim || null;
    acaoAtual = null; // força o crossfade mesmo se o gesto for o mesmo clipe de antes
    for (const b of Object.values(acoesBase)) if (b.isRunning()) b.fadeOut(FADE_S);
    a.reset().setEffectiveWeight(1).fadeIn(FADE_S).play();
    acaoAtual = a;
    return true;
  }
  mixer.addEventListener('finished', (ev) => {
    if (ev.action !== gesto) return;
    gesto = null;
    const fim = aoFimGesto; aoFimGesto = null;
    tocarBase(estadoBase || 'idle');
    if (fim) fim();
  });
  tocarBase('idle');
  if (!acoesBase.idle) console.warn('[vrma] sem clipe idle: o corpo fica na pose de descanso do arquivo.');

  // Aplica o primeiro quadro antes de medir a cabeça (o idle muda a postura).
  mixer.update(0);
  if (quadrilNorm) quadrilDescanso.copy(quadrilNorm.position);
  vrm.update(0);
  vrm.scene.updateMatrixWorld(true);
  const posicaoCabeca = new THREE.Vector3();
  const cabecaRaw = hum.getRawBoneNode('head');
  if (cabecaRaw) cabecaRaw.getWorldPosition(posicaoCabeca);
  else new THREE.Box3().setFromObject(vrm.scene).getCenter(posicaoCabeca);

  // Olhar: um alvo que fica à frente do rosto, com pequenas sacadas; o M6 troca pelo rosto do usuário.
  const alvoOlhar = new THREE.Object3D();
  cena.scene.add(alvoOlhar);
  const olharBase = posicaoCabeca.clone().add(new THREE.Vector3(0, 0, 2));
  const desvio = new THREE.Vector3(), desvioAlvo = new THREE.Vector3();
  let proximaSacada = 1.5, alvoExterno = null;
  if (vrm.lookAt) { vrm.lookAt.target = alvoOlhar; vrm.lookAt.autoUpdate = true; }

  // Piscada: intervalo de 2 a 6 s, às vezes dupla, 150 ms fechando e abrindo.
  let proximaPiscada = 1 + Math.random() * 2, tPiscada = -1, piscadasSeguidas = 0;
  const boca = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  const TETO = { aa: 0.9, ih: 0.6, ou: 0.7, ee: 0.6, oh: 0.8, ...tetoBoca };

  // Reação (ex.: sorriso de volta, M6): sobe 0,2 s, fica, desce 0,4 s.
  let reacao = null;
  // Modo espelho (M6, opcional): números da câmera aplicados por cima do idle.
  let espelho = null;
  const cabecaNorm = hum.getNormalizedBoneNode('head');
  const sinalVrm0 = vrm.meta && vrm.meta.metaVersion === '0' ? -1 : 1; // VRM 0.x inverte X e Z
  const qEspelho = new THREE.Quaternion(), eEspelho = new THREE.Euler(0, 0, 0, 'YXZ');
  // Rotação extra da cabeça (espelho ou seguir o rosto). É desfeita no começo de cada quadro:
  // o idle não anima a cabeça, então somar quadro a quadro fazia a cabeça girar sem parar.
  const qAplicada = new THREE.Quaternion(), qDesfazer = new THREE.Quaternion();
  const segue = { yaw: 0, pitch: 0 };
  const LIMITE_SEGUIR = 0.45; // ~25 graus
  const posCabecaMundo = new THREE.Vector3();
  const LIMITE_CABECA = 0.6; // rad
  const limitar = (v) => Math.max(-LIMITE_CABECA, Math.min(LIMITE_CABECA, v));

  let sobreposicao = null, antesDoMixer = null;
  // Expressões manuais (prompt 7, V3): sobrescrevem as do clipe e as da emoção; a boca falando (visemas) vem antes de tudo e nunca é mexida aqui.
  const manuais = new Map();
  const VISEMAS_E_PISCADA = new Set(['aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'blinkLeft', 'blinkRight', 'lookUp', 'lookDown', 'lookLeft', 'lookRight']);
  // Dono único do olhar: 'auto' (a câmera do rosto ou as sacadas), 'camera' (olha para a câmera da cena) ou 'direcao' (yaw e pitch escolhidos).
  let olharModo = 'auto', olharYaw = 0, olharPitch = 0;
  const alvoDirecao = new THREE.Vector3();
  function atualizar(dt, t, { estado = 'idle', visemas = null } = {}) {
    if (!gesto && !previa) tocarBase(BASE_DO_ESTADO[estado] || 'idle');
    else estadoBase = BASE_DO_ESTADO[estado] || 'idle';
    if (cabecaNorm) cabecaNorm.quaternion.multiply(qDesfazer.copy(qAplicada).invert());
    // Alvo do olhar deste quadro (um dono só): o modo manual manda; em 'auto' vale o alvo externo da câmera do rosto, se houver.
    let alvoExt = alvoExterno;
    if (olharModo === 'camera') alvoExt = cena.camera.position;
    else if (olharModo === 'direcao') alvoExt = alvoDirecao.set(olharBase.x + Math.sin(olharYaw) * 2, olharBase.y + Math.sin(olharPitch) * 2, olharBase.z + Math.cos(olharYaw) * 2);
    if (antesDoMixer) antesDoMixer(); // desfaz a sobreposição do quadro anterior: osso que o clipe não anima (dedos) volta ao repouso
    mixer.update(dt);
    if (quadrilNorm && fixarNoLugar()) { quadrilNorm.position.x = quadrilDescanso.x; quadrilNorm.position.z = quadrilDescanso.z; }
    qAplicada.identity();
    if (cabecaNorm && espelho && espelho.angulos) {
      // Espelho: o usuário vira para a esquerda dele, o avatar vira para a direita dele.
      const a = espelho.angulos;
      eEspelho.set(limitar(a.pitch) * sinalVrm0, limitar(-a.yaw), limitar(-a.roll) * sinalVrm0);
      qAplicada.setFromEuler(eEspelho);
    } else if (cabecaNorm) {
      // Seguir o rosto: a cabeça vira metade do caminho até o alvo; os olhos (lookAt) completam.
      let alvoYaw = 0, alvoPitch = 0;
      if (alvoExt) {
        cabecaRaw.getWorldPosition(posCabecaMundo);
        const dx = alvoExt.x - posCabecaMundo.x, dy = alvoExt.y - posCabecaMundo.y, dz = Math.max(0.3, alvoExt.z - posCabecaMundo.z);
        alvoYaw = Math.max(-LIMITE_SEGUIR, Math.min(LIMITE_SEGUIR, Math.atan2(dx, dz) * 0.5));
        alvoPitch = Math.max(-LIMITE_SEGUIR, Math.min(LIMITE_SEGUIR, -Math.atan2(dy, dz) * 0.5));
      }
      const k = 1 - Math.exp(-dt / 0.25);
      segue.yaw += (alvoYaw - segue.yaw) * k;
      segue.pitch += (alvoPitch - segue.pitch) * k;
      eEspelho.set(segue.pitch * sinalVrm0, segue.yaw, 0);
      qAplicada.setFromEuler(eEspelho);
    }
    if (cabecaNorm) cabecaNorm.quaternion.multiply(qAplicada);

    proximaPiscada -= dt;
    if (proximaPiscada <= 0 && tPiscada < 0) {
      tPiscada = 0;
      const dupla = piscadasSeguidas === 0 && Math.random() < 0.15;
      piscadasSeguidas = dupla ? 1 : 0;
      proximaPiscada = dupla ? 0.25 : 2 + Math.random() * 4;
    }
    let piscada = 0;
    if (tPiscada >= 0) {
      tPiscada += dt;
      piscada = Math.sin(Math.min(tPiscada / 0.15, 1) * Math.PI);
      if (tPiscada > 0.15) tPiscada = -1;
    }

    if (alvoExt) {
      alvoOlhar.position.copy(alvoExt);
    } else {
      proximaSacada -= dt;
      if (proximaSacada <= 0) {
        proximaSacada = 1.5 + Math.random() * 3;
        desvioAlvo.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.12, 0);
      }
      // Pensando: olha um pouco para cima e para o lado (só os olhos, via lookAt).
      const pensando = estado === 'thinking';
      const alvoY = pensando ? 0.45 : desvioAlvo.y, alvoX = pensando ? 0.35 : desvioAlvo.x;
      desvio.x += (alvoX - desvio.x) * (1 - Math.exp(-dt / 0.12));
      desvio.y += (alvoY - desvio.y) * (1 - Math.exp(-dt / 0.12));
      alvoOlhar.position.copy(olharBase).add(desvio);
    }

    if (em) {
      const v = visemas || boca;
      for (const k of Object.keys(boca)) em.setValue(k, Math.min(v[k] || 0, TETO[k]));
      if (espelho) {
        // Olho esquerdo do usuário = olho direito do avatar (frente a frente).
        em.setValue('blink', 0);
        em.setValue('blinkRight', Math.max(piscada, espelho.piscadaE || 0));
        em.setValue('blinkLeft', Math.max(piscada, espelho.piscadaD || 0));
        em.setValue('aa', Math.max(em.getValue('aa') || 0, Math.min(espelho.boca || 0, TETO.aa)));
      } else {
        em.setValue('blink', piscada);
        em.setValue('blinkLeft', 0);
        em.setValue('blinkRight', 0);
      }
      let feliz = espelho ? (espelho.sorriso || 0) * 0.9 : 0;
      if (reacao) {
        reacao.t += dt;
        const { t: tr, dur } = reacao;
        const w = tr < 0.2 ? tr / 0.2 : tr < dur - 0.4 ? 1 : Math.max(0, (dur - tr) / 0.4);
        if (tr >= dur) reacao = null;
        feliz = Math.max(feliz, w * 0.8);
      }
      for (const k of Object.keys(emoAtual)) emoAtual[k] += ((emoAlvo[k] || 0) - emoAtual[k]) * (1 - Math.exp(-dt / 0.35));
      em.setValue('happy', Math.max(feliz, emoAtual.happy));
      for (const k of ['relaxed', 'surprised', 'sad']) if (emoTem[k]) em.setValue(k, emoAtual[k]);
    }
    // Rastreamento do corpo (prompt 7): por cima do clipe, antes de o VRM propagar os ossos. Ordem: mixer, sobreposição, vrm.update.
    if (sobreposicao) sobreposicao(dt);
    if (em && manuais.size) for (const [nome, v] of manuais) em.setValue(nome, v);
    vrm.update(dt);
  }

  // Prévia da galeria: toca um clipe qualquer por cima da máquina de estados até parar ou acabar.
  let previa = null;
  function pararPrevia() {
    if (!previa) return;
    previa.fadeOut(FADE_S);
    previa = null;
    mixer.timeScale = 1;
    // A ação de antes saiu com fadeOut; zera para o próximo quadro escolher o estado de novo.
    acaoAtual = null;
    tocarBase(estadoBase || 'idle');
  }
  // Quem toca em sequência (visualizador) quer saber quando o clipe de uma vez acabou.
  let aoFimPrevia = null;
  mixer.addEventListener('finished', (ev) => {
    if (!previa || ev.action !== previa) return;
    const cb = aoFimPrevia; aoFimPrevia = null;
    pararPrevia();
    if (cb) cb();
  });

  return {
    vrm,
    posicaoCabeca,
    previa: {
      tocar(clipe, { velocidade = 1, laco = false } = {}) {
        if (previa) previa.stop();
        previa = mixer.clipAction(clipe);
        previa.setLoop(laco ? THREE.LoopRepeat : THREE.LoopOnce, laco ? Infinity : 1);
        previa.clampWhenFinished = true;
        previa.timeScale = velocidade;
        previa.reset().setEffectiveWeight(1).fadeIn(FADE_S).play();
        // O clipe da prévia pode ser o próprio clipe-base (o idle): mixer.clipAction devolve a MESMA ação,
        // e apagá-la aqui deixava o personagem em T-pose.
        if (acaoAtual && acaoAtual !== previa) acaoAtual.fadeOut(FADE_S);
        if (gesto) { gesto = null; aoFimGesto = null; }
        acaoAtual = previa;
        mixer.timeScale = 1;
      },
      pausar(sim) { if (previa) mixer.timeScale = sim ? 0 : 1; },
      velocidade(v) { if (previa) previa.timeScale = v; },
      parar() { aoFimPrevia = null; pararPrevia(); },
      aoTerminar(fn) { aoFimPrevia = fn; },
      get ativa() { return !!previa; },
      // Põe o clipe da prévia num instante e aplica a pose já, sem andar o relógio (para a miniatura do Photo Booth).
      // Sem relógio andando, o fadeIn da prévia fica no peso 0 e o fadeOut da base no 1: a pose saía da base (ou T-pose). Aqui o clipe vale inteiro.
      buscar(tempo) {
        if (!previa) return;
        previa.stopFading(); previa.setEffectiveWeight(1);
        for (const a of Object.values(acoesBase)) if (a !== previa) { a.stopFading(); a.setEffectiveWeight(0); }
        previa.time = Math.max(0, tempo); mixer.update(0); vrm.update(0);
      },
      get duracao() { return previa ? previa.getClip().duration : 0; },
      get tempo() { return previa ? previa.time : 0; },
    },
    atualizar,
    definirSobreposicao(fn, antes = null) { sobreposicao = fn; antesDoMixer = antes; },
    // Expressões que o .vrm realmente tem (sem visemas, piscada e olhar), para os controles de 0 a 100.
    expressoesDisponiveis() { return em ? em.expressions.map((e) => e.expressionName).filter((n) => !VISEMAS_E_PISCADA.has(n)) : []; },
    definirExpressaoManual(nome, valor) {
      if (!em || VISEMAS_E_PISCADA.has(nome) || !em.getExpression(nome)) return false;
      const v = Math.max(0, Math.min(1, Number(valor) || 0));
      if (v === 0) manuais.delete(nome); else manuais.set(nome, v);
      if (v === 0) em.setValue(nome, 0); // sem o valor manual, a emoção e o clipe voltam a mandar no quadro seguinte
      return true;
    },
    zerarExpressoesManuais() { for (const n of manuais.keys()) em.setValue(n, 0); manuais.clear(); },
    get expressoesManuais() { return Object.fromEntries(manuais); },
    definirOlhar({ modo = 'auto', yaw = 0, pitch = 0 } = {}) {
      olharModo = ['auto', 'camera', 'direcao'].includes(modo) ? modo : 'auto';
      olharYaw = Math.max(-0.8, Math.min(0.8, yaw)); olharPitch = Math.max(-0.5, Math.min(0.5, pitch));
    },
    get olhar() { return { modo: olharModo, yaw: olharYaw, pitch: olharPitch }; },
    // Posição da cabeça AGORA no mundo (posicaoCabeca é a do carregamento). Para o rastreamento da câmera.
    cabecaAgora(alvo) {
      const osso = hum.getRawBoneNode('head');
      if (osso) osso.getWorldPosition(alvo); else alvo.copy(posicaoCabeca);
      return alvo;
    },
    // Altura real do corpo no mundo, para o enquadramento de corpo inteiro. Mede vértice a vértice
    // (precise), porque a caixa da geometria não acompanha o esqueleto. Cabelo e acessórios entram.
    medidaCorpo() {
      vrm.scene.updateMatrixWorld(true);
      const caixa = new THREE.Box3().setFromObject(vrm.scene, true);
      const c = caixa.getCenter(new THREE.Vector3());
      return { base: caixa.min.y, topo: caixa.max.y, x: c.x, z: c.z };
    },
    get bases() { return Object.keys(acoesBase); },
    get estadoBase() { return estadoBase; },
    // Toca um gesto de uma vez; aoFim roda quando ele acaba e o corpo volta ao estado-base.
    tocarGesto,
    definirEmocao,
    get gestoAtivo() { return gesto ? gesto.getClip().name : null; },
    get tempoGesto() { return gesto ? gesto.time : null; },
    // Posição no mundo para onde olhar (rosto do usuário, M6); null volta ao olhar de repouso.
    olharPara(pos) { alvoExterno = pos ? new THREE.Vector3(pos.x, pos.y, pos.z) : null; },
    // Expressão rápida de reação (só "happy" hoje). Duração em segundos.
    reagir(duracao = 2) { reacao = { t: 0, dur: Math.max(0.8, duracao) }; },
    get reagindo() { return !!reacao; },
    get giroCabeca() { return { yaw: segue.yaw }; },
    // dados = { piscadaE, piscadaD, boca, sorriso, angulos:{yaw,pitch,roll} } ou null para sair do espelho.
    espelhar(dados) { espelho = dados; },
    descartar() {
      mixer.stopAllAction();
      mixer.uncacheRoot(vrm.scene);
      cena.scene.remove(alvoOlhar);
      cena.scene.remove(vrm.scene);
      VRMUtils.deepDispose(vrm.scene);
    },
  };
}
