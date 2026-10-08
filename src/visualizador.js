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
//   entrada() -> { clipe, modo: 'repetir' | 'lista-depois', loop: [ids] } do personagem em cena, ou null (prompt 07, V2)
//   antesDeTocar(): Promise opcional, esperada ao entrar e antes de o primeiro clipe tocar (o Photo Booth gera as miniaturas aqui)
//   reduzirMovimento: MediaQueryList
//   aoMudar({ ativo, tocando, ... }): a interface atualiza rótulos
export function criarVisualizador({ cena, raiz, palco, el, T, avatar, clipesAtivos, carregarClipe, entrada = () => null, antesDeTocar = null, reduzirMovimento, aoMudar = () => {}, aoSair = () => {}, aoEntrar = () => {} }) {
  const s = {
    ativo: false, tocando: false, modo: 'todos', velocidade: 1, seguir: false,
    indice: -1, clipe: null, telaCheia: false, telaCheiaCss: false,
    restringir: [], entradaPendente: false, lacuna: null, // entrada por personagem
  };
  let lista = [], pedido = 0, timerBarra = null, ultimoToque = 0, hiddenPausou = false;

  let obterEntrada = entrada;
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

  // Entrada do personagem (V2): qual clipe abre o visualizador. 'repetir' repete só esse clipe; 'lista-depois' toca uma vez e segue em
  // loop pelos ids de loopAnimacoes. Clipe da entrada ausente (não ativo, filtrado pelo modo infantil ou sem arquivo): cai para o idle e
  // registra a lacuna. Os botões anterior e próximo continuam passando por todos os clipes; só o avanço automático segue a lista.
  function planoDeEntrada() {
    const e = obterEntrada();
    s.restringir = []; s.entradaPendente = false; s.lacuna = null;
    if (!e || !lista.length) return 0;
    let i = lista.findIndex((c) => c.id === e.clipe);
    if (i < 0) {
      s.lacuna = e.clipe;
      console.warn(`[visualizador] clipe de entrada "${e.clipe}" indisponível; usando o idle`);
      i = lista.findIndex((c) => c.id === 'idle');
      if (i < 0) i = 0;
    }
    s.modo = e.modo === 'repetir' ? 'um' : 'todos';
    s.restringir = (e.loop || []).filter((id) => lista.some((c) => c.id === id));
    s.entradaPendente = e.modo === 'lista-depois' && s.restringir.length > 0;
    return i;
  }

  function proximoIndice(passo, auto = false) {
    if (!lista.length) return -1;
    if (auto && s.restringir.length) {
      const cand = lista.map((c, i) => (s.restringir.includes(c.id) ? i : -1)).filter((i) => i >= 0);
      s.entradaPendente = false;
      if (s.modo === 'aleatorio' && cand.length > 1) { let i; do { i = cand[Math.floor(Math.random() * cand.length)]; } while (i === s.indice); return i; }
      const depois = cand.find((i) => i > s.indice);
      return depois !== undefined ? depois : cand[0]; // depois da entrada e no fim da lista, volta ao começo da lista do personagem
    }
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
    a.previa.aoTerminar(() => { if (s.ativo && s.tocando && s.modo !== 'um') proximo({ auto: true }); });
    el.nome.textContent = nomeDoClipe(c);
    emitir();
  }

  // Toca o clipe pelo id (miniatura do Photo Booth ou lista suspensa). Sai do avanço automático da entrada: o usuário escolheu.
  function tocarPorId(id) {
    const i = lista.findIndex((c) => c.id === id);
    if (i < 0) return Promise.resolve(false);
    s.entradaPendente = false;
    s.tocando = true;
    return tocarIndice(i).then(() => true);
  }
  function proximo({ auto = false } = {}) { return tocarIndice(proximoIndice(1, auto === true)); }
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
    if (antesDeTocar) { try { await antesDeTocar(); } catch (e) { console.warn('[visualizador] preparo antes de tocar falhou:', e); } if (!s.ativo) return false; }
    // Com "reduzir movimento" o loop começa pausado; a pessoa aperta tocar quando quiser.
    const inicio = planoDeEntrada();
    if (tocarAgora && !reduzirMovimento.matches && lista.length) {
      s.tocando = true; await tocarIndice(inicio);
      if (!s.clipe && s.ativo) { // o arquivo da entrada não carregou: tenta o idle uma vez
        const idle = lista.findIndex((c) => c.id === 'idle');
        if (idle >= 0 && idle !== inicio) { s.lacuna = s.lacuna || (lista[inicio] && lista[inicio].id); await tocarIndice(idle); }
      }
    } else if (lista.length) { s.indice = inicio; s.clipe = lista[inicio]; el.nome.textContent = nomeDoClipe(lista[inicio]); }
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
    const inicio = planoDeEntrada();
    s.indice = lista.length ? inicio : -1; s.clipe = lista[inicio] || null;
    el.nome.textContent = nomeDoClipe(s.clipe);
    if (s.tocando) tocarIndice(inicio);
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
    tocar, pausar, alternar, proximo, anterior, tocarPorId,
    get clipes() { return lista; }, definirModo, proximoModo, definirVelocidade,
    aoTrocarPersonagem,
    // Troca a regra de entrada (null = sem entrada: abre no primeiro clipe e anda pela lista toda). Usado em testes e no painel do operador.
    definirEntrada(fn) { obterEntrada = typeof fn === 'function' ? fn : () => null; },
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
