// Webcam com MediaPipe Face Landmarker, tudo no navegador.
// Privacidade: desligada por padrão; nenhum quadro é gravado, salvo ou enviado. Só números
// (posição do rosto, sorriso, ângulos da cabeça) viram estado local. Desligar para as tracks.
// Inferência limitada (padrão 15/s) e pausada com a aba oculta.

// MediaPipe hospedado em assets/vendor/mediapipe/ (tasks-vision 1.0.1, só a variante wasm com SIMD; ver assets/vendor/CREDITS.md).
const URL_TASKS = new URL('assets/vendor/mediapipe/vision_bundle.mjs', location.href).href;
const URL_WASM = new URL('assets/vendor/mediapipe/wasm', location.href).href;
const URL_MODELO = 'assets/mediapipe/face_landmarker.task'; // float16/1, do bucket oficial mediapipe-models

/* ---------- Partes puras (testadas em tests/unit/camera.test.js) ---------- */

// Filtro One Euro (Casiez et al., 2012): suaviza tremor parado sem atrasar movimento rápido.
export class FiltroOneEuro {
  constructor({ minCutoff = 1.0, beta = 0.02, dCutoff = 1.0 } = {}) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.x = null; this.dx = 0; this.t = null;
  }
  static alfa(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filtrar(valor, tSeg) {
    if (this.x === null) { this.x = valor; this.t = tSeg; return valor; }
    const dt = Math.max(1e-3, tSeg - this.t);
    this.t = tSeg;
    const dxBruto = (valor - this.x) / dt;
    this.dx += FiltroOneEuro.alfa(this.dCutoff, dt) * (dxBruto - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += FiltroOneEuro.alfa(cutoff, dt) * (valor - this.x);
    return this.x;
  }
}

// Ângulos da cabeça (radianos) a partir da matriz 4x4 coluna-maior do MediaPipe.
export function angulosDaMatriz(m) {
  // Rotação R: colunas 0..2. yaw em torno de Y, pitch em torno de X, roll em torno de Z.
  const r00 = m[0], r10 = m[1], r20 = m[2], r21 = m[6], r22 = m[10];
  return {
    yaw: Math.atan2(-r20, Math.hypot(r21, r22)),
    pitch: Math.atan2(r21, r22),
    roll: Math.atan2(r10, r00),
  };
}

// Resultado do Face Landmarker -> números que o app usa.
export function interpretar(resultado) {
  const lm = resultado && resultado.faceLandmarks && resultado.faceLandmarks[0];
  if (!lm) return { presente: false };
  const nariz = lm[1];
  const bs = {};
  const cats = resultado.faceBlendshapes && resultado.faceBlendshapes[0] ? resultado.faceBlendshapes[0].categories : [];
  for (const c of cats) bs[c.categoryName] = c.score;
  const matriz = resultado.facialTransformationMatrixes && resultado.facialTransformationMatrixes[0];
  return {
    presente: true,
    x: nariz.x, // 0..1 na imagem da câmera (sem espelhar)
    y: nariz.y,
    sorriso: ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2,
    piscadaE: bs.eyeBlinkLeft || 0,
    piscadaD: bs.eyeBlinkRight || 0,
    boca: bs.jawOpen || 0,
    angulos: matriz ? angulosDaMatriz(matriz.data) : null,
  };
}

// Presença com histerese: aparece depois de `aparece` s vendo rosto; some depois de `some` s sem rosto.
export function criarPresenca({ aparece = 0.5, some = 8 } = {}) {
  let presente = false, desde = null;
  return {
    get presente() { return presente; },
    atualizar(viuRosto, tSeg) {
      if (viuRosto === presente) { desde = null; return null; }
      if (desde === null) desde = tSeg;
      if (tSeg - desde >= (viuRosto ? aparece : some)) {
        presente = viuRosto; desde = null;
        return presente ? 'apareceu' : 'sumiu';
      }
      return null;
    },
  };
}

// Sorriso sustentado: dispara uma vez quando passa do limiar por `duracao` s; espera `intervalo` s.
export function criarDetectorSorriso({ limiar = 0.55, duracao = 0.3, intervalo = 4 } = {}) {
  let desde = null, ultimo = -Infinity;
  return {
    atualizar(sorriso, tSeg) {
      if (sorriso < limiar) { desde = null; return false; }
      if (desde === null) desde = tSeg;
      if (tSeg - desde >= duracao && tSeg - ultimo >= intervalo) { ultimo = tSeg; desde = null; return true; }
      return false;
    },
  };
}

/* ---------- Câmera (DOM) ---------- */

export function criarCamera({ aoMudar, aoLeitura, fps = 15 }) {
  let landmarker = null, stream = null, video = null, ligada = false, relogio = null, delegado = null;

  async function prepararModelo() {
    if (landmarker) return;
    const { FilesetResolver, FaceLandmarker } = await import(URL_TASKS);
    const fileset = await FilesetResolver.forVisionTasks(URL_WASM);
    const opcoes = (delegate) => ({
      baseOptions: { modelAssetPath: URL_MODELO, delegate },
      runningMode: 'VIDEO', numFaces: 1,
      outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
    });
    try {
      landmarker = await FaceLandmarker.createFromOptions(fileset, opcoes('GPU'));
      delegado = 'GPU';
    } catch (e) {
      console.warn('[camera] GPU indisponível para o MediaPipe, usando CPU:', e);
      landmarker = await FaceLandmarker.createFromOptions(fileset, opcoes('CPU'));
      delegado = 'CPU';
    }
  }

  function passo() {
    if (!ligada) return;
    if (!document.hidden && video.readyState >= 2) {
      const r = landmarker.detectForVideo(video, performance.now());
      aoLeitura(interpretar(r), performance.now() / 1000);
    }
    relogio = setTimeout(passo, 1000 / fps);
  }

  return {
    get ligada() { return ligada; },
    get delegado() { return delegado; },
    // fonte: MediaStream opcional (testes usam um canvas.captureStream()); padrão: webcam.
    async ligar({ fonte } = {}) {
      if (ligada) return;
      aoMudar({ estado: 'ligando' });
      try {
        stream = fonte || await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
        video = document.createElement('video');
        video.muted = true; video.playsInline = true; video.srcObject = stream;
        await video.play();
        await prepararModelo();
        ligada = true;
        aoMudar({ estado: 'ligada' });
        passo();
      } catch (e) {
        console.error('[camera] não ligou:', e);
        this.desligar();
        aoMudar({ estado: 'erro', motivo: e.name === 'NotAllowedError' ? 'permissão negada' : e.name === 'NotFoundError' ? 'nenhuma câmera encontrada' : e.message });
      }
    },
    desligar() {
      ligada = false;
      clearTimeout(relogio);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (video) { video.pause(); video.srcObject = null; }
      stream = null; video = null;
      aoMudar({ estado: 'desligada' });
    },
    // Para testes e diagnóstico: as tracks estão paradas?
    get tracksAtivas() { return stream ? stream.getTracks().filter((t) => t.readyState === 'live').length : 0; },
  };
}
