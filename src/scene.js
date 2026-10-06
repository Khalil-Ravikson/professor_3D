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
// aoPerderContexto e aoRestaurarContexto: a GPU pode tirar o contexto WebGL a qualquer
// momento (driver atualizado, suspensão da máquina, memória de vídeo no limite). Sem
// tratar isso, a tela fica congelada para sempre.
export function criarCena(container, { aoPerderContexto, aoRestaurarContexto } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  criarLuzes(scene);

  const foco = new THREE.Vector3(0, 1.5, 0);
  let distancia = 1.7;

  // Câmera suavizada: o enquadramento novo vira um alvo e a câmera chega nele em ~300 ms.
  // Trocar de rosto para corpo inteiro (e de personagem) vira deslize e escala, não corte.
  const alvoPos = new THREE.Vector3(), alvoOlhar = new THREE.Vector3(), olharAtual = new THREE.Vector3();
  // `deslizando` só é verdadeiro até a câmera chegar no alvo. Depois disso a cena não escreve mais na câmera,
  // para quem a move por fora (o teste da câmera simulada, por exemplo) não ser desfeito a cada quadro.
  let temAlvo = false, pular = true, deslizando = false;

  // Corpo inteiro: { base, topo, x, z } em metros no mundo. A medida vem do próprio .vrm,
  // então personagem novo enquadra sem número à mão. Pés a 84% da altura do quadro e topo a 13%,
  // o que deixa o pódio em CSS embaixo e a cabeça abaixo da faixa de botões do topo.
  let corpo = null;
  const FRACAO_PES = 0.84, FRACAO_TOPO = 0.13;

  function calcularAlvo() {
    if (corpo) {
      const visivel = (corpo.topo - corpo.base) / (FRACAO_PES - FRACAO_TOPO);
      const d = visivel / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      const yCentro = corpo.topo - (0.5 - FRACAO_TOPO) * visivel;
      alvoPos.set(corpo.x, yCentro, corpo.z + d);
      alvoOlhar.set(corpo.x, yCentro, corpo.z);
    } else {
      // Em tela estreita (totem em pé) afasta para caber os ombros.
      const dist = camera.aspect < 0.75 ? distancia * 1.24 : distancia;
      alvoPos.set(foco.x, foco.y - 0.03, foco.z + dist);
      alvoOlhar.set(foco.x, foco.y - 0.14, foco.z);
    }
    temAlvo = true;
    deslizando = true;
  }

  function aplicarAlvo(dt) {
    if (!temAlvo || !deslizando) return;
    if (pular) {
      camera.position.copy(alvoPos); olharAtual.copy(alvoOlhar); pular = false;
      deslizando = false;
    } else {
      const k = 1 - Math.exp(-dt * 11);
      camera.position.lerp(alvoPos, k);
      olharAtual.lerp(alvoOlhar, k);
      // Chegou: 0,5 mm de diferença já não se enxerga.
      if (camera.position.distanceToSquared(alvoPos) < 2.5e-7 && olharAtual.distanceToSquared(alvoOlhar) < 2.5e-7) {
        camera.position.copy(alvoPos); olharAtual.copy(alvoOlhar); deslizando = false;
      }
    }
    camera.lookAt(olharAtual);
  }

  function enquadrar() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    calcularAlvo();
    pular = true; // redimensionar não anima: a câmera acompanha a janela na hora
    aplicarAlvo(0);
  }
  new ResizeObserver(enquadrar).observe(container);

  function definirFoco(posicaoCabeca, enq) {
    foco.copy(posicaoCabeca);
    foco.y += enq.altura;
    distancia = enq.distancia;
    corpo = null;
    calcularAlvo();
    pular = true;
    aplicarAlvo(0);
  }

  // medida: { base, topo, x, z } ou null para voltar ao enquadramento do rosto.
  // animar: false corta direto (primeira carga de um modelo); true desliza.
  function definirCorpo(medida, animar = true) {
    corpo = medida;
    calcularAlvo();
    if (!animar) { pular = true; aplicarAlvo(0); }
  }

  const atualizadores = new Set();
  const relogio = new THREE.Clock();
  // Marca de cada quadro: alimenta o contador de FPS e o vigia do laço.
  let ultimoQuadro = performance.now(), quadros = 0, contextoPerdido = false;

  function iniciar() {
    renderer.setAnimationLoop(() => {
      ultimoQuadro = performance.now();
      quadros++;
      const dt = Math.min(relogio.getDelta(), 0.1), t = relogio.elapsedTime;
      for (const fn of atualizadores) fn(dt, t);
      aplicarAlvo(dt);
      renderer.render(scene, camera);
    });
  }

  const tela = renderer.domElement;
  // Sem preventDefault o navegador nem tenta restaurar o contexto.
  tela.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    contextoPerdido = true;
    renderer.setAnimationLoop(null);
    console.error('[cena] o contexto WebGL foi perdido.');
    if (aoPerderContexto) aoPerderContexto();
  });
  tela.addEventListener('webglcontextrestored', () => {
    contextoPerdido = false;
    // O relógio andou enquanto a tela estava parada; zerar evita um salto de animação.
    relogio.getDelta();
    ultimoQuadro = performance.now();
    iniciar();
    console.info('[cena] contexto WebGL restaurado.');
    if (aoRestaurarContexto) aoRestaurarContexto();
  });

  return {
    renderer, scene, camera,
    definirFoco, definirCorpo, enquadrar, iniciar,
    get modoCorpo() { return !!corpo; },
    aoAtualizar(fn) { atualizadores.add(fn); return () => atualizadores.delete(fn); },
    get ultimoQuadro() { return ultimoQuadro; },
    get quadros() { return quadros; },
    get contextoPerdido() { return contextoPerdido; },
    // Só para teste: tira o contexto de verdade, como a GPU faria.
    perderContextoDeProposito() {
      const ext = renderer.getContext().getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      // O navegador só devolve o contexto se alguém pedir; num quiosque ninguém pede.
      setTimeout(() => { try { ext.restoreContext(); } catch (e) { console.warn('[cena] restoreContext:', e); } }, 300);
      return true;
    },
  };
}
