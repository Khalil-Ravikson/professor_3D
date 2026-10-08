// Tela "Photo Booth" do visualizador (prompt 7, V1, wireframes aprovados em 08/10/2026): fundo claro com o nome do personagem em contorno, faixa de miniaturas
// de animação à esquerda (renderizadas do próprio .vrm, guardadas no IndexedDB), pausa, painel flutuante com abas à direita (folha inferior no retrato) e
// botões de foto e vídeo. Inspiração de estrutura, não cópia: nenhuma marca, texto ou ícone de terceiros. É uma CAMADA sobre o visualizador existente: o
// loop, a câmera, o reset e a tela cheia continuam sendo dele. Modo público (totem): abas Animações e Expressões, sem foto, vídeo nem envio de arquivo.
import { lerMiniatura, gravarMiniatura } from './miniaturas.js';
import { recorte } from './captura.js';

const el = (tag, atrib = {}, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atrib)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const f of filhos.flat()) if (f != null) e.append(f.nodeType ? f : document.createTextNode(f));
  return e;
};
const MAX_MINIS = 40; // a faixa mostra todos os clipes ativos (rola de lado no retrato e para baixo na paisagem); eram só 6 e os novos ficavam escondidos
const ehNovo = (c) => /\/overte\//.test(c.arquivo || ''); // clipes do Overte, de 08/10/2026: ganham a marca "Novo"
const LARGURA_MINI = 160, ALTURA_MINI = 200;

export function criarPhotoBooth({ palco, raiz, T, visualizador, avatar, cena, personagem, publico, carregarClipe, controles }) {
  const P = T.photobooth;
  const urls = new Map(); // id do clipe -> data URL da miniatura
  let abaAtual = 'animacoes', raizPb = null, faixa = null, painel = null, corpoAbas = null, selClipe = null, btnPausa = null, nomeAtual = null;
  const nomeDoClipe = (id) => P.nomes[id] || id.replace(/-/g, ' ');

  /* ---------- Miniaturas: um quadro de cada clipe, renderizado do próprio .vrm ---------- */
  const versaoDoClipe = (c) => `${c.arquivo}|${c.duracao || ''}|v3`; // v3: a pose da miniatura é a do clipe (v2 guardava a T-pose do modelo parado)
  const chave = (c) => `clipe:${personagem().id}:${c.id}`;
  function capturarQuadro() {
    cena.renderer.render(cena.scene, cena.camera); // o canvas WebGL só é legível logo depois do render, na mesma tarefa
    const fonte = cena.renderer.domElement;
    const r = recorte(fonte.width, fonte.height, '4:5');
    // Aproxima no personagem: o miolo do recorte (62%), um pouco acima do centro, para a miniatura mostrar o corpo e não o palco vazio.
    const k = 0.62, sw = Math.round(r.sw * k), sh = Math.round(r.sh * k);
    const sx = r.sx + Math.round((r.sw - sw) / 2), sy = r.sy + Math.round((r.sh - sh) * 0.3);
    const c = document.createElement('canvas'); c.width = LARGURA_MINI; c.height = ALTURA_MINI;
    c.getContext('2d').drawImage(fonte, sx, sy, sw, sh, 0, 0, LARGURA_MINI, ALTURA_MINI);
    return c.toDataURL('image/webp', 0.8);
  }
  async function gerarMiniaturas() {
    const a = avatar();
    if (!a) return;
    const lista = visualizador.clipes.slice(0, MAX_MINIS); // só as da faixa: gerar as 11 atrasava a primeira abertura; o resto está no seletor
    const falta = [];
    // Lê todas de uma vez: cada leitura do IndexedDB espera um quadro do navegador, e em fila isso somava segundos em máquina lenta.
    const lidas = await Promise.all(lista.map((c) => lerMiniatura(chave(c), versaoDoClipe(c))));
    lista.forEach((c, i) => { if (lidas[i]) urls.set(c.id, lidas[i].url); else falta.push(c); });
    desenharFaixa();
    if (!falta.length) return;
    palco.classList.add('pb-gerando');
    try {
      for (const c of falta) {
        try {
          const clipe = await carregarClipe(c);
          if (!clipe) continue;
          a.previa.tocar(clipe, { velocidade: 1, laco: false });
          a.previa.pausar(true);
          a.previa.buscar(Math.min(clipe.duration * 0.4, 3));
          const url = capturarQuadro();
          urls.set(c.id, url);
          await gravarMiniatura(chave(c), versaoDoClipe(c), url);
        } catch (e) { console.warn(`[photobooth] sem miniatura de "${c.id}":`, e); }
        desenharFaixa();
      }
    } finally {
      a.previa.parar();
      palco.classList.remove('pb-gerando');
    }
  }

  /* ---------- Faixa de miniaturas (à esquerda; horizontal no retrato) ---------- */
  function desenharFaixa() {
    if (!faixa) return;
    const atual = visualizador.estado.clipe && visualizador.estado.clipe.id;
    faixa.replaceChildren();
    // Os novos vêm primeiro: no retrato a faixa rola de lado e quem não rola não via as animações novas.
    const ordem = [...visualizador.clipes].sort((x, y) => Number(ehNovo(y)) - Number(ehNovo(x)));
    for (const c of ordem.slice(0, MAX_MINIS)) {
      const img = urls.get(c.id);
      faixa.append(el('button', { type: 'button', class: 'pb-mini', 'data-id': c.id, 'aria-pressed': String(c.id === atual), 'aria-label': nomeDoClipe(c.id), title: nomeDoClipe(c.id), onclick: () => visualizador.tocarPorId(c.id) },
        img ? el('img', { src: img, alt: '', draggable: 'false' }) : el('span', { class: 'pb-mini-vazia', 'aria-hidden': 'true' }),
        el('span', { class: 'pb-mini-nome' }, nomeDoClipe(c.id)),
        ehNovo(c) ? el('span', { class: 'pb-mini-novo' }, P.novo) : null));
    }
    if (visualizador.clipes.length > MAX_MINIS) faixa.append(el('button', { type: 'button', class: 'pb-mini pb-mais', 'aria-label': P.mais, title: P.mais, onclick: () => { mostrarAba('animacoes'); selClipe && selClipe.focus(); } }, '...'));
  }

  /* ---------- Painel com abas ---------- */
  const seg = (rotulos, aoEscolher, atual) => el('div', { class: 'pb-seg', role: 'group' }, rotulos.map(([valor, texto]) => el('button', { type: 'button', class: 'pb-seg-b', 'data-valor': String(valor), 'aria-pressed': String(valor === atual), onclick: () => aoEscolher(valor) }, texto)));
  function abaAnimacoes() {
    selClipe = el('select', { id: 'pbClipe', onchange: () => visualizador.tocarPorId(selClipe.value) },
      visualizador.clipes.map((c) => el('option', { value: c.id }, nomeDoClipe(c.id))));
    const x = [
      el('label', { for: 'pbClipe' }, P.clipeAtual), selClipe,
      el('p', { class: 'pb-rot' }, P.repeticao), seg([['um', P.um], ['todos', P.todos], ['aleatorio', P.aleatorio]], (v) => visualizador.definirModo(v), visualizador.estado.modo),
      el('p', { class: 'pb-rot' }, P.velocidade), seg([[0.5, '0,5x'], [1, '1x'], [1.5, '1,5x']], (v) => visualizador.definirVelocidade(v), visualizador.estado.velocidade),
    ];
    if (!publico()) x.push(el('div', { class: 'pb-op' }, el('strong', {}, `${P.operador}: `), P.enviarDica, ' ',
      el('button', { type: 'button', class: 'pb-link', onclick: controles.abrirEnvio }, P.enviarVrma)));
    return x;
  }
  function abaExpressoes() {
    const a = avatar();
    const nomes = a ? a.expressoesDisponiveis() : [];
    const x = [];
    if (publico()) {
      const dispo = ['happy', 'surprised', 'sad', 'relaxed', 'angry'].map((k) => nomes.find((n) => n.toLowerCase() === k)).filter(Boolean);
      x.push(el('div', { class: 'pb-grade' }, [...dispo.map((n) => el('button', { type: 'button', class: 'pb-expr', 'aria-pressed': String(!!(a.expressoesManuais[n])), onclick: () => { a.zerarExpressoesManuais(); a.definirExpressaoManual(n, 1); mostrarAba('expressoes', true); } }, P.expressao[n.toLowerCase()] || n)),
        el('button', { type: 'button', class: 'pb-expr', onclick: () => { a.zerarExpressoesManuais(); mostrarAba('expressoes', true); } }, P.zerar)]));
    } else {
      for (const n of nomes) {
        const id = `pbx_${n}`;
        x.push(el('label', { for: id }, P.expressao[n.toLowerCase()] || n),
          el('input', { type: 'range', id, min: '0', max: '100', value: String(Math.round((a.expressoesManuais[n] || 0) * 100)), oninput: (e) => a.definirExpressaoManual(n, Number(e.target.value) / 100) }));
      }
      x.push(el('button', { type: 'button', class: 'pb-link', onclick: () => { a.zerarExpressoesManuais(); mostrarAba('expressoes', true); } }, P.zerar));
    }
    x.push(el('label', { class: 'pb-check' }, el('input', { type: 'checkbox', id: 'pbOlhar', checked: !!(a && a.olhar.modo === 'camera'), onchange: (e) => controles.olharParaCamera(e.target.checked) }), ` ${P.olharCamera}`));
    return x;
  }
  function abaRastreamento() {
    const x = [el('p', { class: 'pb-dica' }, P.imitarDica), ligarCorpoBotao(), el('p', { class: 'pb-estado', id: 'pbCorpoEstado', role: 'status', 'aria-live': 'polite' }, controles.estadoCorpo())];
    for (const [id, rotulo] of controles.chavesCorpo) {
      x.push(el('label', { class: 'pb-check' }, el('input', { type: 'checkbox', 'data-corpo': id, checked: controles.valorCorpo(id), onchange: (e) => controles.definirCorpo(id, e.target.checked) }), ` ${rotulo}`));
    }
    x.push(el('button', { type: 'button', class: 'pb-link', onclick: controles.recalibrar }, T.corpo.recalibrar));
    return x;
  }
  const ligarCorpoBotao = () => el('button', { type: 'button', class: 'pb-grande', id: 'pbImitar', 'aria-pressed': String(controles.corpoLigado()), onclick: () => { controles.alternarCorpo(); setTimeout(() => mostrarAba('rastreamento', true), 50); } }, P.imitar);
  function abaFundo() {
    const f = controles.foto;
    const x = [
      el('label', { for: 'pbFundo' }, P.fundo), seletor('pbFundo', f.fundo, [['transparente', T.captura.fundoTransparente], ['branco', T.captura.fundoBranco], ['paleta', T.captura.fundoPaleta]]),
      el('label', { for: 'pbProp' }, T.captura.proporcao), seletor('pbProp', f.prop, [['1:1', '1:1'], ['4:5', '4:5'], ['16:9', '16:9'], ['9:16', '9:16']]),
      el('label', { class: 'pb-check' }, el('input', { type: 'checkbox', checked: f.moldura.checked, onchange: (e) => { f.moldura.checked = e.target.checked; f.moldura.dispatchEvent(new Event('change')); } }), ` ${T.captura.moldura}`),
      el('p', { class: 'pb-dica', id: 'pbLicenca', role: 'status' }, f.lic.textContent),
    ];
    return x;
  }
  function seletor(id, origem, opcoes) { // espelha um <select> das configurações: o painel e a engrenagem mandam na mesma coisa
    const s = el('select', { id, onchange: () => { origem.value = s.value; origem.dispatchEvent(new Event('change')); } }, opcoes.map(([v, t]) => el('option', { value: v }, t)));
    s.value = origem.value; return s;
  }
  const abasDisponiveis = () => (publico() ? ['animacoes', 'expressoes'] : ['animacoes', 'expressoes', 'rastreamento', 'fundo']);
  function mostrarAba(nome, manter = false) {
    if (!abasDisponiveis().includes(nome)) nome = 'animacoes';
    abaAtual = nome;
    if (!corpoAbas) return;
    for (const b of raizPb.querySelectorAll('[role=tab]')) { const sel = b.dataset.aba === nome; b.setAttribute('aria-selected', String(sel)); b.tabIndex = sel ? 0 : -1; }
    corpoAbas.replaceChildren(...({ animacoes: abaAnimacoes, expressoes: abaExpressoes, rastreamento: abaRastreamento, fundo: abaFundo }[nome])());
    corpoAbas.setAttribute('aria-labelledby', `pbAba_${nome}`);
    atualizar(visualizador.estado);
  }

  /* ---------- Montagem ---------- */
  function montar() {
    if (raizPb) return;
    btnPausa = el('button', { type: 'button', class: 'pb-pausa', id: 'pbPausa', onclick: () => visualizador.alternar() });
    nomeAtual = el('p', { class: 'pb-nome', 'aria-live': 'polite' });
    faixa = el('nav', { class: 'pb-faixa', 'aria-label': P.faixa });
    const abas = el('div', { class: 'pb-abas', role: 'tablist', 'aria-label': P.rotulo });
    corpoAbas = el('div', { class: 'pb-corpo', role: 'tabpanel', tabindex: '0' });
    // Padrão de abas do WAI-ARIA: setas, Home e End andam entre as abas visíveis e ativam a que recebe o foco.
    abas.addEventListener('keydown', (ev) => {
      const visiveis = [...abas.querySelectorAll('[role=tab]')].filter((b) => !b.hidden);
      const i = visiveis.indexOf(document.activeElement);
      if (i < 0) return;
      const destino = { ArrowRight: visiveis[(i + 1) % visiveis.length], ArrowLeft: visiveis[(i - 1 + visiveis.length) % visiveis.length], Home: visiveis[0], End: visiveis[visiveis.length - 1] }[ev.key];
      if (!destino) return;
      ev.preventDefault(); destino.focus(); mostrarAba(destino.dataset.aba);
    });
    painel = el('section', { class: 'pb-painel', 'aria-label': P.rotulo }, abas, corpoAbas);
    const fotoBtn = el('button', { type: 'button', class: 'pb-pilula', id: 'pbFoto', onclick: () => controles.foto.foto.click() }, P.foto);
    const videoBtn = el('button', { type: 'button', class: 'pb-pilula', id: 'pbVideo', onclick: () => controles.foto.video.click() }, P.video);
    const acoes = el('div', { class: 'pb-acoes' }, fotoBtn, videoBtn, el('p', { class: 'pb-acoes-nota', id: 'pbAcoesNota' }));
    raizPb = el('div', { class: 'pb', id: 'pb', hidden: true },
      el('div', { class: 'pb-fundo', 'aria-hidden': 'true', id: 'pbPadrao' }),
      el('button', { type: 'button', class: 'pb-imitar', id: 'pbImitarTopo', onclick: controles.alternarCorpo }, P.imitar),
      btnPausa, faixa, painel, acoes, nomeAtual);
    for (const a of ['animacoes', 'expressoes', 'rastreamento', 'fundo']) {
      abas.append(el('button', { type: 'button', role: 'tab', id: `pbAba_${a}`, 'data-aba': a, onclick: () => mostrarAba(a) }, P.abas[a]));
    }
    palco.append(raizPb);
  }
  function preencherFundo() {
    const f = document.getElementById('pbPadrao');
    if (!f) return;
    const nome = (personagem().nome || '').toUpperCase();
    f.replaceChildren(...Array.from({ length: 6 }, () => el('span', {}, `${nome} `.repeat(6))));
  }

  // Chamado pelo visualizador a cada mudança de estado.
  function atualizar(e) {
    if (!raizPb) return;
    for (const b of faixa.querySelectorAll('.pb-mini[data-id]')) b.setAttribute('aria-pressed', String(!!e.clipe && b.dataset.id === e.clipe.id));
    btnPausa.setAttribute('aria-pressed', String(e.tocando));
    btnPausa.setAttribute('aria-label', e.tocando ? P.pausar : P.tocar); btnPausa.title = e.tocando ? P.pausar : P.tocar;
    btnPausa.replaceChildren(el('span', { class: e.tocando ? 'pb-i-pausa' : 'pb-i-tocar', 'aria-hidden': 'true' }));
    nomeAtual.textContent = e.clipe ? nomeDoClipe(e.clipe.id) : '';
    if (selClipe && e.clipe) selClipe.value = e.clipe.id;
    for (const g of raizPb.querySelectorAll('.pb-seg')) for (const b of g.children) {
      const valor = b.dataset.valor;
      b.setAttribute('aria-pressed', String(valor === String(e.modo) || valor === String(e.velocidade)));
    }
    const pub = publico(), fotoOk = !pub && !controles.foto.foto.disabled, videoOk = !pub && !controles.foto.video.disabled;
    const pf = document.getElementById('pbFoto'), pv = document.getElementById('pbVideo');
    if (pf) { pf.disabled = !fotoOk; pv.disabled = !videoOk; }
    const nota = document.getElementById('pbAcoesNota');
    if (nota) nota.textContent = pub ? P.desligadoPublico : controles.foto.foto.disabled ? controles.foto.lic.textContent.split('. ')[0].replace(/\.$/, '') + '.' : '';
    const imitar = document.getElementById('pbImitarTopo');
    if (imitar) imitar.setAttribute('aria-pressed', String(controles.corpoLigado()));
    const cs = document.getElementById('pbCorpoEstado');
    if (cs) cs.textContent = controles.estadoCorpo();
  }

  return {
    montar,
    // Ao entrar no visualizador: monta (uma vez), reconstrói as abas do modo atual e gera as miniaturas que faltam.
    async preparar() {
      montar();
      preencherFundo();
      raizPb.hidden = false;
      for (const b of raizPb.querySelectorAll('[role=tab]')) b.hidden = !abasDisponiveis().includes(b.dataset.aba);
      desenharFaixa();
      mostrarAba(abasDisponiveis().includes(abaAtual) ? abaAtual : 'animacoes');
      await gerarMiniaturas();
    },
    sair() { if (raizPb) raizPb.hidden = true; palco.classList.remove('pb-gerando'); },
    atualizar, mostrarAba, desenharFaixa, gerarMiniaturas,
    get miniaturas() { return urls; },
  };
}
