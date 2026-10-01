import * as THREE from 'three';

export function criarLuzes(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c6d8, 1.6));
  const principal = new THREE.DirectionalLight(0xffffff, 1.8);
  principal.position.set(1.2, 2.5, 2.5);
  scene.add(principal);
  const contra = new THREE.DirectionalLight(0xffe2c8, 0.8);
  contra.position.set(-2, 1.5, -1.5);
  scene.add(contra);
}

// A câmera fica um pouco abaixo do foco e mira mais abaixo ainda (desvioAlvo),
// para caber rosto e ombros. Na miniatura o desvio é 0: só o rosto.
export function apontarCamera(camera, foco, distancia, desvioAlvo = -0.14) {
  camera.position.set(foco.x, foco.y - 0.03, foco.z + distancia);
  camera.lookAt(foco.x, foco.y + desvioAlvo, foco.z);
  camera.updateProjectionMatrix();
}

// Fundo transparente: a cor vem do CSS (paleta do personagem), sem geometria de cenário.
export function criarCena(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  criarLuzes(scene);

  const foco = new THREE.Vector3(0, 1.5, 0);
  let distancia = 1.7;

  function enquadrar() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Em tela estreita (totem em pé) afasta para caber os ombros.
    apontarCamera(camera, foco, camera.aspect < 0.75 ? distancia * 1.24 : distancia);
  }
  new ResizeObserver(enquadrar).observe(container);

  function definirFoco(posicaoCabeca, enq) {
    foco.copy(posicaoCabeca);
    foco.y += enq.altura;
    distancia = enq.distancia;
    enquadrar();
  }

  const atualizadores = new Set();
  const relogio = new THREE.Clock();
  function iniciar() {
    renderer.setAnimationLoop(() => {
      const dt = Math.min(relogio.getDelta(), 0.1), t = relogio.elapsedTime;
      for (const fn of atualizadores) fn(dt, t);
      renderer.render(scene, camera);
    });
  }

  return {
    renderer, scene, camera,
    definirFoco, enquadrar, iniciar,
    aoAtualizar(fn) { atualizadores.add(fn); return () => atualizadores.delete(fn); },
  };
}
