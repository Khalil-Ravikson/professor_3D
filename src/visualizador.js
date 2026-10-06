// Visualizador de personagem, no estilo da demonstração do VRoid Hub: câmera livre, reset, rastreamento,
// tela cheia e loop de animações. Modo "Experience": o personagem lidera e os controles recuam.
//
// Só usa clipes `ativos` do catálogo (animacoes.json): nada de pose inventada em código. A câmera é do
// OrbitControls (src/scene.js); o loop usa a prévia do avatar (src/avatar.js), que já faz crossfade de 0,3 s.
// Por quadro, na ordem: mixer.update, vrm.update (dentro de avatar.atualizar) e controls.update (em scene.js).

export const MODOS = ['um', 'todos', 'aleatorio'];
export const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5];
const OCULTAR_BARRA_MS = 3000;
const DUPLO_TOQUE_MS = 320;

// deps:
//   cena, raiz (#app), palco (#stage), el { barra, nome, entrar, aviso, botoes... }
//   avatar() -> avatar atual ou null
//   clipesAtivos() -> clipes do catálogo com status ativo (já com as escolhas da galeria e o modo infantil)
//   carregarClipe(clipe) -> Promise<AnimationClip | null>
//   reduzirMovimento: MediaQueryList
//   aoMudar({ ativo, tocando, ... }): a interface atualiza rótulos
export function criarVisualizador({ cena, raiz, palco, el, T, avatar, clipesAtivos, carregarClipe, reduzirMovimento, aoMudar = () => {}, aoSair = () => {}, aoEntrar = () => {} }) {
  const s = {
    ativo: false, tocando: false, modo: 'todos', velocidade: 1, seguir: false,
    indice: -1, clipe: null, telaCheia: false, telaCheiaCss: false,
  };
  let lista = [], pedido = 0, timerBarra = null, ultimoToque = 0, hiddenPausou = false;

  const emitir = () => aoMudar({ ...s, total: lista.length });
  const nomeDoClipe = (c) => (c ? c.id : '');

  /* ---------- Câmera ---------- */
  function resetar() {
    if (!s.ativo) return;
    cena.resetarCamera(reduzirMovimento.matches ? 0 : 500);
  }

  function seguirCabeca(v) {
    const a = avatar();
    if (a) a.cabecaAgora(v);
  }

  function definirSeguir(sim) {
    s.seguir = !!sim;
    cena.definirSeguir(s.seguir ? seguirCabeca : null);
    emitir();
  }

  /* ---------- Loop de animações ---------- */
  function atualizarLista() {
    lista = clipesAtivos();
    if (s.indice >= lista.length) s.indice = lista.length - 1;
  }

  function proximoIndice(passo) {
    if (!lista.length) return -1;
    if (s.modo === 'aleatorio' && lista.length > 1) {
      let i; do { i = Math.floor(Math.random() * lista.length); } while (i === s.indice);
      return i;
    }
    return (s.indice + passo + lista.length) % lista.length;
  }

  async function tocarIndice(i) {
    const a = avatar();
    if (!a || !lista.length || i < 0) return;
    const minha = ++pedido;
    const c = lista[i];
    const clipe = await carregarClipe(c);
    if (minha !== pedido || !s.ativo) return; // outro pedido chegou, ou o visualizador fechou
    if (!clipe) { s.clipe = null; emitir(); return; }
    s.indice = i; s.clipe = c;
    // Modo "um" repete o clipe; nos outros, cada clipe toca uma vez e o fim chama o próximo.
    a.previa.tocar(clipe, { velocidade: s.velocidade, laco: s.modo === 'um' });
    a.previa.pausar(!s.tocando);
    a.previa.aoTerminar(() => { if (s.ativo && s.tocando && s.modo !== 'um') proximo(); });
    el.nome.textContent = nomeDoClipe(c);
    emitir();
  }

  function proximo() { return tocarIndice(proximoIndice(1)); }
  function anterior() { return tocarIndice(proximoIndice(-1)); }

  function tocar() {
    const a = avatar();
    if (!a) return;
    s.tocando = true;
    if (!a.previa.ativa) tocarIndice(s.indice >= 0 ? s.indice : 0);
    else a.previa.pausar(false);
    emitir();
  }
  function pausar() {
    const a = avatar();
    s.tocando = false;
    if (a && a.previa.ativa) a.previa.pausar(true);
    emitir();
  }
  const alternar = () => (s.tocando ? pausar() : tocar());

  function definirModo(m) {
    if (!MODOS.includes(m)) return;
    s.modo = m;
    const a = avatar();
    // Muda o laço do clipe que está tocando: "um" repete, os outros terminam e passam adiante.
    if (a && a.previa.ativa && s.clipe) tocarIndice(s.indice);
    emitir();
  }
  const proximoModo = () => definirModo(MODOS[(MODOS.indexOf(s.modo) + 1) % MODOS.length]);

  function definirVelocidade(v) {
    s.velocidade = Math.min(1.5, Math.max(0.5, Number(v) || 1));
    const a = avatar();
    if (a && a.previa.ativa) a.previa.velocidade(s.velocidade);
    emitir();
  }

  /* ---------- Tela cheia ---------- */
  const temTelaCheia = () => !!(palco.requestFullscreen || palco.webkitRequestFullscreen);

  async function alternarTelaCheia() {
    if (s.telaCheiaCss) { sairTelaCheiaCss(); return; }
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (!temTelaCheia()) {
      // iPhone e alguns navegadores não têm a API: ocupa a janela por CSS e avisa.
      s.telaCheiaCss = true; palco.classList.add('tela-cheia-css'); mostrarAviso(T.visualizador.semTelaCheia); emitir();
      return;
    }
    try { await (palco.requestFullscreen || palco.webkitRequestFullscreen).call(palco); }
    catch (e) {
      console.warn('[visualizador] tela cheia recusada:', e);
      s.telaCheiaCss = true; palco.classList.add('tela-cheia-css'); mostrarAviso(T.visualizador.semTelaCheia); emitir();
    }
  }
  function sairTelaCheiaCss() { s.telaCheiaCss = false; palco.classList.remove('tela-cheia-css'); emitir(); }

  function aoMudarTelaCheia() {
    s.telaCheia = document.fullscreenElement === palco;
    if (s.telaCheia) mostrarBarra(); else clearTimeout(timerBarra);
    // O contêiner mudou de tamanho: a cena já observa o redimensionamento (ResizeObserver), e o pixel ratio
    // fica em no máximo 2 desde a criação do renderer.
    emitir();
  }

  function mostrarAviso(texto) {
    el.aviso.textContent = texto; el.aviso.hidden = false;
    setTimeout(() => { el.aviso.hidden = true; }, 5000);
  }

  // Em tela cheia a barra some depois de 3 s sem movimento e volta ao mexer.
  function mostrarBarra() {
    el.barra.dataset.oculta = 'nao';
    clearTimeout(timerBarra);
    if (s.telaCheia || s.telaCheiaCss) timerBarra = setTimeout(() => { if (!el.barra.matches(':focus-within')) el.barra.dataset.oculta = 'sim'; }, OCULTAR_BARRA_MS);
  }

  /* ---------- Entrar e sair ---------- */
  async function entrar({ tocarAgora = false } = {}) {
    if (s.ativo || !avatar()) return false;
    s.ativo = true;
    raiz.dataset.visualizador = 'sim';
    el.barra.parentElement.hidden = false;
    aoEntrar();
    cena.ativarOrbita();
    atualizarLista();
    s.tocando = false;
    // Com "reduzir movimento" o loop começa pausado; a pessoa aperta tocar quando quiser.
    if (tocarAgora && !reduzirMovimento.matches && lista.length) { s.tocando = true; await tocarIndice(0); }
    else if (lista.length) { s.indice = 0; s.clipe = lista[0]; el.nome.textContent = nomeDoClipe(lista[0]); }
    mostrarBarra();
    emitir();
    return true;
  }

  function sair() {
    if (!s.ativo) return;
    s.ativo = false; s.tocando = false; pedido++;
    const a = avatar();
    if (a) a.previa.parar();
    cena.desativarOrbita(); // solta os ouvintes do OrbitControls
    definirSeguir(false);
    if (document.fullscreenElement === palco) document.exitFullscreen().catch((e) => console.warn('[visualizador] sair da tela cheia:', e));
    sairTelaCheiaCss();
    delete raiz.dataset.visualizador;
    el.barra.parentElement.hidden = true;
    clearTimeout(timerBarra);
    aoSair();
    emitir();
  }

  // Trocaram o personagem com o visualizador aberto: o avatar antigo foi descartado, o novo já está em cena.
  function aoTrocarPersonagem() {
    if (!s.ativo) return;
    pedido++;
    atualizarLista();
    s.indice = lista.length ? 0 : -1; s.clipe = lista[0] || null;
    el.nome.textContent = nomeDoClipe(s.clipe);
    if (s.tocando) tocarIndice(0);
    emitir();
  }

  /* ---------- Entrada: teclado, duplo clique, duplo toque, aba oculta ---------- */
  function aoTeclar(e) {
    if (!s.ativo || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, dialog[open]')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const acoes = {
      r: resetar, f: alternarTelaCheia, t: () => definirSeguir(!s.seguir),
      ' ': alternar, ArrowRight: proximo, ArrowLeft: anterior, ArrowDown: proximo, ArrowUp: anterior,
      Escape: () => { if (!document.fullscreenElement && !s.telaCheiaCss) sair(); },
    };
    if (!acoes[k]) return;
    // Espaço em botão focado dispara o clique do botão: evita acionar duas vezes.
    if (k === ' ' && e.target.closest && e.target.closest('button')) return;
    e.preventDefault();
    acoes[k]();
    mostrarBarra();
  }

  // Duplo clique (mouse) e duplo toque (dedo) no canvas resetam a câmera.
  function aoPonteiro(e) {
    if (!s.ativo || e.target !== cena.renderer.domElement) return;
    const agora = performance.now();
    if (e.pointerType === 'touch' && agora - ultimoToque < DUPLO_TOQUE_MS) { resetar(); ultimoToque = 0; } else ultimoToque = agora;
    mostrarBarra();
  }
  const aoDuploClique = (e) => { if (s.ativo && e.target === cena.renderer.domElement) resetar(); };

  function aoMudarVisibilidade() {
    if (!s.ativo) return;
    if (document.hidden) { hiddenPausou = s.tocando; if (s.tocando) pausar(); }
    else if (hiddenPausou) { hiddenPausou = false; tocar(); }
  }

  document.addEventListener('keydown', aoTeclar);
  document.addEventListener('fullscreenchange', aoMudarTelaCheia);
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  palco.addEventListener('pointerdown', aoPonteiro);
  palco.addEventListener('dblclick', aoDuploClique);
  palco.addEventListener('pointermove', () => { if (s.ativo) mostrarBarra(); });

  return {
    get estado() { return { ...s, total: lista.length }; },
    get ativo() { return s.ativo; },
    entrar, sair, resetar, definirSeguir, alternarTelaCheia, temTelaCheia,
    tocar, pausar, alternar, proximo, anterior, definirModo, proximoModo, definirVelocidade,
    aoTrocarPersonagem,
    descartar() {
      sair();
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('fullscreenchange', aoMudarTelaCheia);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      palco.removeEventListener('pointerdown', aoPonteiro);
      palco.removeEventListener('dblclick', aoDuploClique);
    },
  };
}
