// Movimentos enviados pelo operador (aba "Enviar movimento" no painel).
// O arquivo (.fbx do Mixamo ou .vrma) fica só neste navegador, no IndexedDB; nunca vai para o repositório.
// Cada registro vira um clipe do catálogo com arquivo "enviado:<id>" (ver clipeDoArquivo em avatar.js).
import * as THREE from 'three';

const BANCO = 'prof3d', LOJA = 'movimentos';

function abrir() {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'id' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

async function operar(modo, fn) {
  const db = await abrir();
  try {
    return await new Promise((ok, falha) => {
      const tx = db.transaction(LOJA, modo);
      const req = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(req && req.result);
      tx.onerror = () => falha(tx.error);
      tx.onabort = () => falha(tx.error || new Error('transação abortada (cota cheia?)'));
    });
  } finally {
    db.close();
  }
}

export const listarMovimentos = () => operar('readonly', (s) => s.getAll());
export const salvarMovimento = (registro) => operar('readwrite', (s) => s.put(registro));
export const apagarMovimento = (id) => operar('readwrite', (s) => s.delete(id));

// id legível e único a partir do nome: "Aceno longo" -> "env-aceno-longo-k3f9".
export function idDoNome(nome) {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'movimento';
  return `env-${base}-${Math.random().toString(36).slice(2, 6)}`;
}

// Medidas do clipe no próprio modelo (as mesmas da folha de contato, mais a distância mão-rosto).
// Mexe nos ossos normalizados para amostrar e devolve tudo como estava no fim.
export function medirClipe(clipe, vrm) {
  const hum = vrm.humanoid;
  const nomes = Object.keys(hum.humanBones);
  const guardado = nomes.map((n) => { const o = hum.getNormalizedBoneNode(n); return o && [o, o.quaternion.clone(), o.position.clone()]; }).filter(Boolean);
  const mixer = new THREE.AnimationMixer(vrm.scene);
  mixer.clipAction(clipe).play();
  const quadril = hum.getNormalizedBoneNode('hips'), cabeca = hum.getNormalizedBoneNode('head');
  const maos = ['leftHand', 'rightHand'].map((n) => hum.getNormalizedBoneNode(n)).filter(Boolean);
  const ossosPose = ['hips', 'spine', 'chest', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftUpperLeg', 'rightUpperLeg'].map((n) => hum.getNormalizedBoneNode(n)).filter(Boolean);
  const p = new THREE.Vector3(), pc = new THREE.Vector3(), pm = new THREE.Vector3();
  function amostra(t) {
    mixer.setTime(t); vrm.scene.updateMatrixWorld(true);
    quadril.getWorldPosition(p);
    return { p: p.clone(), qs: ossosPose.map((o) => o.quaternion.clone()) };
  }
  try {
    const D = clipe.duration || 0.001;
    const ini = amostra(0), fim = amostra(Math.max(0, D - 1e-3));
    // Rosto: um pouco acima do osso da cabeça (o osso fica na base do crânio).
    let desloc = 0, maoRosto = Infinity;
    for (let k = 0; k <= 60; k++) {
      const a = amostra((D * k) / 60);
      desloc = Math.max(desloc, Math.hypot(a.p.x - ini.p.x, a.p.z - ini.p.z));
      cabeca.getWorldPosition(pc); pc.y += 0.08;
      for (const m of maos) { m.getWorldPosition(pm); maoRosto = Math.min(maoRosto, pm.distanceTo(pc)); }
    }
    const difAng = Math.max(0, ...ini.qs.map((q, i) => q.angleTo(fim.qs[i])));
    return {
      duracao: +D.toFixed(2),
      quadrilDeslocHorizM: +desloc.toFixed(3),
      inicioFimGraus: +THREE.MathUtils.radToDeg(difAng).toFixed(1),
      maoRostoMinM: +maoRosto.toFixed(3),
      // Laço só se o fim encaixa no começo.
      pareceLaco: difAng < THREE.MathUtils.degToRad(5),
    };
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(vrm.scene);
    for (const [o, q, pos] of guardado) { o.quaternion.copy(q); o.position.copy(pos); }
  }
}

// Avisos em linguagem simples a partir das medidas. A mão na frente do rosto NÃO é detectada: a distância
// do pulso não separa o aceno que cobre o rosto do sinal de paz, que fica bem perto de propósito
// (medido em 01/10/2026 nos 5 modelos). Isso se confere olhando a prévia, que usa o enquadramento do rosto.
export function avisosDasMedidas(m) {
  const a = [];
  if (m.quadrilDeslocHorizM > 0.05) a.push(`o corpo anda ${Math.round(m.quadrilDeslocHorizM * 100)} cm (com "fixar no lugar" ligado, fica parado)`);
  if (m.inicioFimGraus > 15) a.push(`começa e termina em poses diferentes (${Math.round(m.inicioFimGraus)} graus): a troca com o repouso pode dar um salto`);
  return a;
}
