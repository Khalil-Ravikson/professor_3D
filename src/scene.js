import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Rig de luz de três pontos, definido nos dados do personagem (campo `luz` de characters.js):
// principal suave, preenchimento frio e recorte quente no cabelo. O ambiente (hemisfério) completa.
// Os valores padrão são os que o app já usava; um personagem só muda o que declarar.
export const LUZ_PADRAO = {
  ambiente: { ceu: '#ffffff', chao: '#b7c6d8', intensidade: 1.6 },
  principal: { cor: '#ffffff', intensidade: 1.8, pos: [1.2, 2.5, 2.5] },
  preenchimento: { cor: '#bcd2ff', intensidade: 0, pos: [-2, 1, 2] },
  recorte: { cor: '#ffe2c8', intensidade: 0.8, pos: [-2, 1.5, -1.5] },
};

export function criarLuzes(scene, dados = null) {
  const luzes = {
    ambiente: new THREE.HemisphereLight(0xffffff, 0xb7c6d8, 1.6),
    principal: new THREE.DirectionalLight(0xffffff, 1.8),
    preenchimento: new THREE.DirectionalLight(0xbcd2ff, 0),
    recorte: new THREE.DirectionalLight(0xffe2c8, 0.8),
  };
  for (const l of Object.values(luzes)) scene.add(l);
  luzes.aplicar = (d) => aplicarLuz(luzes, d);
  luzes.aplicar(dados);
  return luzes;
}

// Mistura o que o personagem declara com o padrão, ponto a ponto.
export function aplicarLuz(luzes, dados) {
  const m = (k) => ({ ...LUZ_PADRAO[k], ...((dados && dados[k]) || {}) });
  const amb = m('ambiente');
  luzes.ambiente.color.set(amb.ceu); luzes.ambiente.groundColor.set(amb.chao); luzes.ambiente.intensity = amb.intensidade;
  for (const k of ['principal', 'preenchimento', 'recorte']) {
    const v = m(k);
    luzes[k].color.set(v.cor); luzes[k].intensity = v.intensidade; luzes[k].position.set(...v.pos);
  }
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
  const luzes = criarLuzes(scene);

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
    if (orbita) return; // com a câmera livre, quem manda é o OrbitControls (e o reset, abaixo)
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

  // ---------- Câmera livre (visualizador) ----------
  // OrbitControls com amortecimento, limites de distância e de ângulo vertical (não passa do chão nem vira
  // de cabeça para baixo). O reset devolve a câmera ao enquadramento padrão do personagem em 0,5 s, com
  // suavização. O rastreamento leva o alvo e a câmera juntos atrás de um ponto (a cabeça), e pausa 3 s
  // quando a pessoa gira a câmera à mão.
  let orbita = null, reinicio = null, seguirPonto = null, pausaSeguir = 0, orbitaAuto = false;
  const alvoSeguido = new THREE.Vector3();
  const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

  function ativarOrbita() {
    if (orbita) return orbita;
    calcularAlvo();
    camera.position.copy(alvoPos);
    olharAtual.copy(alvoOlhar);
    orbita = new OrbitControls(camera, renderer.domElement);
    orbita.enableDamping = true;
    orbita.dampingFactor = 0.08;
    orbita.minDistance = 0.7;
    orbita.maxDistance = 6;
    orbita.minPolarAngle = THREE.MathUtils.degToRad(15);
    orbita.maxPolarAngle = THREE.MathUtils.degToRad(95); // um pouco abaixo do horizonte: dá para ver os pés, não o chão por baixo
    orbita.screenSpacePanning = true;
    orbita.target.copy(alvoOlhar);
    orbita.update();
    orbita.addEventListener('start', () => { pausaSeguir = 3; reinicio = null; });
    return orbita;
  }

  function desativarOrbita() {
    if (!orbita) return;
    orbita.dispose(); // solta os ouvintes de ponteiro e de roda do mouse
    orbita = null; reinicio = null; seguirPonto = null;
    calcularAlvo(); pular = true; deslizando = true; // a câmera volta ao enquadramento da etapa
  }

  // ms = 0 salta direto (prefers-reduced-motion).
  // Zera a inércia do amortecimento: sem isto o OrbitControls continua empurrando a câmera depois do reset.
  function parar() { orbita.enableDamping = false; orbita.update(); orbita.enableDamping = true; }

  function resetarCamera(ms = 500) {
    if (!orbita) return;
    calcularAlvo();
    parar();
    if (ms <= 0) { camera.position.copy(alvoPos); orbita.target.copy(alvoOlhar); parar(); reinicio = null; return; }
    reinicio = { t: 0, dur: ms / 1000, de: camera.position.clone(), deAlvo: orbita.target.clone(), para: alvoPos.clone(), paraAlvo: alvoOlhar.clone() };
  }

  // fn(vetor) preenche o ponto a seguir, ou null desliga. O ponto é lido a cada quadro.
  function definirSeguir(fn) { seguirPonto = fn || null; }

  // Câmera livre desde a conversa, sem precisar do visualizador. Só liga depois que a câmera termina de deslizar
  // para o enquadramento, para o OrbitControls não congelá-la no meio do caminho nem dar salto.
  function orbitaAutomatica(ligada) {
    orbitaAuto = !!ligada;
    if (!orbitaAuto) desativarOrbita();
  }

  function passoOrbita(dt) {
    if (!orbita) {
      if (orbitaAuto && temAlvo && !deslizando) ativarOrbita();
      return;
    }
    if (reinicio) {
      reinicio.t += dt;
      const k = suave(Math.min(1, reinicio.t / reinicio.dur));
      camera.position.lerpVectors(reinicio.de, reinicio.para, k);
      orbita.target.lerpVectors(reinicio.deAlvo, reinicio.paraAlvo, k);
      if (reinicio.t >= reinicio.dur) reinicio = null;
    } else if (seguirPonto) {
      if (pausaSeguir > 0) pausaSeguir -= dt;
      else {
        seguirPonto(alvoSeguido);
        const k = 1 - Math.exp(-dt * 5);
        const dx = (alvoSeguido.x - orbita.target.x) * k, dy = (alvoSeguido.y - orbita.target.y) * k, dz = (alvoSeguido.z - orbita.target.z) * k;
        orbita.target.x += dx; orbita.target.y += dy; orbita.target.z += dz;
        camera.position.x += dx; camera.position.y += dy; camera.position.z += dz; // a câmera acompanha sem mudar o ângulo
      }
    }
    orbita.update(); // por último: depois do mixer e do vrm.update, que já rodaram nos atualizadores
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

  // ---------- Qualidade adaptativa (R1) ----------
  // Guiada por FPS medido: cai um degrau do pixel ratio depois de 3 s abaixo de 30 fps e sobe um depois de
  // 10 s acima de 55. O pixel ratio é o que mais pesa na GPU de um totem; sombra e bloom ainda não existem
  // na cena, então não há o que cortar depois dele.
  const DEGRAUS = [2, 1.5, 1, 0.75];
  const teto = Math.min(devicePixelRatio || 1, 2);
  let degrau = 0, autoQualidade = false, baixo = 0, alto = 0, marcaQ = performance.now(), quadrosQ = 0;
  const aplicarDegrau = () => { renderer.setPixelRatio(Math.min(teto, DEGRAUS[degrau])); enquadrar(); };
  function passoQualidade() {
    if (!autoQualidade || contextoPerdido || document.hidden) { marcaQ = performance.now(); quadrosQ = quadros; return; }
    const agora = performance.now();
    if (agora - marcaQ < 1000) return;
    const fps = ((quadros - quadrosQ) * 1000) / (agora - marcaQ);
    marcaQ = agora; quadrosQ = quadros;
    if (fps < 30) { baixo++; alto = 0; } else if (fps > 55) { alto++; baixo = 0; } else { baixo = 0; alto = 0; }
    if (baixo >= 3 && degrau < DEGRAUS.length - 1) { degrau++; baixo = 0; aplicarDegrau(); console.info(`[cena] qualidade reduzida: pixel ratio ${Math.min(teto, DEGRAUS[degrau])} (${fps.toFixed(0)} fps)`); }
    if (alto >= 10 && degrau > 0) { degrau--; alto = 0; aplicarDegrau(); console.info(`[cena] qualidade restaurada: pixel ratio ${Math.min(teto, DEGRAUS[degrau])}`); }
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
      passoOrbita(dt);
      passoQualidade();
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
    ativarOrbita, desativarOrbita, orbitaAutomatica, resetarCamera, definirSeguir,
    get orbitaAtiva() { return !!orbita; },
    get orbita() { return orbita; },
    // Onde o reset deixa a câmera: para o teste e para o painel.
    luzes,
    definirLuz(dados) { luzes.aplicar(dados); },
    // Liga ou desliga o ajuste automático. Desligar devolve o pixel ratio cheio.
    qualidadeAuto(ligada) { autoQualidade = !!ligada; baixo = alto = 0; if (!autoQualidade && degrau !== 0) { degrau = 0; aplicarDegrau(); } },
    get qualidade() { return { degrau, pixelRatio: Math.min(teto, DEGRAUS[degrau]), automatica: autoQualidade }; },
    alvoPadrao() { calcularAlvo(); return { posicao: alvoPos.clone(), olhar: alvoOlhar.clone() }; },
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
