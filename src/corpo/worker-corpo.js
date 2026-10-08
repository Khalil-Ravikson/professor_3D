// Worker do rastreamento do corpo (prompt 7, V5): roda o Pose Landmarker e o Hand Landmarker FORA da thread principal (a documentação
// do MediaPipe recomenda). Recebe ImageBitmap de cada quadro, devolve SÓ NÚMEROS (landmarks de mundo e visibilidade). O quadro é
// fechado logo depois de usado: nenhuma imagem é guardada ou enviada.
// Mensagens de entrada:  { tipo: 'iniciar', base, modelo, maos }   { tipo: 'quadro', bitmap, t }   { tipo: 'fechar' }
// Mensagens de saída:    { tipo: 'pronto', delegado }  { tipo: 'erro', mensagem }  { tipo: 'resultado', t, pose, normalizado, maos: [{ mundo, norm }], ms }
// WORKER CLÁSSICO (não módulo): o carregador do wasm do MediaPipe usa importScripts, que não existe de verdade em worker módulo
// (erro "ModuleFactory not set"). O bundle ESM entra por import() dinâmico, que funciona nos dois tipos.
let pose = null, mao = null, ocupado = false, MP = null;
const num = (p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 });

async function iniciar({ base, modelo, maos }) {
  MP = await import(base + 'vision_bundle.mjs');
  const { FilesetResolver, PoseLandmarker, HandLandmarker } = MP;
  const fileset = await FilesetResolver.forVisionTasks(base + 'wasm');
  let delegado = 'GPU';
  const criarPose = (delegate) => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: base + 'modelos/' + modelo, delegate },
    runningMode: 'VIDEO', numPoses: 1, // numPoses 1: evento com muita gente, a pessoa principal (REPERTORIO 32.3)
  });
  try { pose = await criarPose('GPU'); }
  catch (e) { delegado = 'CPU'; pose = await criarPose('CPU'); }
  if (maos) {
    mao = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: base + 'modelos/hand_landmarker.task', delegate: delegado },
      runningMode: 'VIDEO', numHands: 2,
    });
  }
  postMessage({ tipo: 'pronto', delegado });
}

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.tipo === 'iniciar') await iniciar(m);
    else if (m.tipo === 'fechar') { if (pose) pose.close(); if (mao) mao.close(); pose = mao = null; self.close(); }
    else if (m.tipo === 'quadro') {
      if (!pose || ocupado) { m.bitmap.close(); return; } // sem fila: quadro atrasado é descartado, a latência não cresce
      ocupado = true;
      const t0 = performance.now();
      const r = pose.detectForVideo(m.bitmap, m.t);
      // As maos podem rodar so em quadros alternados (m.maos === false): o resultado vem com maosAtualizadas false e o app segue com a ultima mao.
      const mr = mao && m.maos !== false ? mao.detectForVideo(m.bitmap, m.t) : null;
      m.bitmap.close();
      const mundo = r.worldLandmarks && r.worldLandmarks[0];
      const norm = r.landmarks && r.landmarks[0];
      let maos = null;
      if (mr && mr.worldLandmarks) {
        // Sem rótulo de lado: a documentação diz que "Left" e "Right" assumem imagem espelhada. O app associa cada mão ao pulso da pose.
        maos = mr.worldLandmarks.map((lm, i) => ({ mundo: lm.map(num), norm: ((mr.landmarks && mr.landmarks[i]) || []).map(num), rotulo: (mr.handedness && mr.handedness[i] && mr.handedness[i][0] && mr.handedness[i][0].categoryName) || null }));
      }
      postMessage({ tipo: 'resultado', t: m.t, pose: mundo ? mundo.map(num) : null, normalizado: norm ? norm.map(num) : null, maos, maosAtualizadas: !!mr, ms: performance.now() - t0 });
      ocupado = false;
    }
  } catch (e) {
    ocupado = false;
    postMessage({ tipo: 'erro', mensagem: String((e && e.message) || e) });
  }
};
