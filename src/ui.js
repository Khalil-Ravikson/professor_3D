import { criarCena } from './scene.js';
import {
  carregarVrm, checarVrm, registrarChecklist, montarAvatar, descartarVrm,
  verificarArquivo, gerarMiniatura, carregarClipes, clipeDoArquivo, registrarEnviado, esquecerEnviado, AvatarAusenteError,
} from './avatar.js';
import { listarMovimentos, salvarMovimento, apagarMovimento, idDoNome, medirClipe, avisosDasMedidas } from './movimentos.js';
import { carregarCatalogo, aplicarEscolhas, gravarEscolha } from './animacoes.js';
import { criarDiretor, removerMarcas, instrucaoGestos, ESTADOS_BASE } from './gestos.js';
import { instrucaoEmocao } from './emocao.js';
import { criarPoliticaSessao, itensAprovados } from './evento.js';
import { criarEmbeddings, MODELO_EMB } from './rag/embeddings.js';
import { criarRag } from './rag/rag.js';
import { instrucaoRag, fontesCitadas } from './rag/prompt.js';
import { registrarSW, aplicarAtualizacao, pedirPersistencia, usoEcota, tamanhosPorCategoria, apagarCategoria, prontoOffline, baixarParaOffline, formatarBytes, temServiceWorker } from './armazenamento.js';
import { criarBoca } from './lipsync.js';
import { PERSONAGENS, buscarPersonagem, aplicarAjustes } from './characters.js';
import { criarQuadro, criarLeitorMarcado, separarFalaEQuadro } from './board.js';
import { calcular, DECLARACAO_CALCULAR } from './calcular.js';
import { criarCamera, criarPresenca, criarDetectorSorriso, FiltroOneEuro } from './camera.js';
import { perguntarEmFluxo, ErroGemini, MODELO_PADRAO } from './brain.js';
import { criarVoz } from './tts/index.js';
import { URL_PADRAO } from './tts/kokoro-server.js';
import { criarDivisor, limparParaFala } from './tts/frases.js';
import { criarOuvido } from './ouvido.js';
import { ler, gravar, lerJSON, gravarJSON } from './storage.js';
import { T } from './strings.pt-BR.js';
import { avaliarLicenca } from './licenca.js';
import { criarVigia, contarRecargas, esquecerRecargas } from './vigia.js';
import { criarDiagnostico } from './diagnostico.js';
import { lerMiniatura, gravarMiniatura } from './miniaturas.js';
import { criarVisualizador } from './visualizador.js';
import { criarMedidorDeCusto, CAMBIO_PADRAO, situacaoDoTeto } from './custo.js';
import { projetar, mediaPorResposta } from './projecao.js';
import { chaveDoModelo } from './custo.js';
import { VERSAO, VERSAO_DATA, VERSAO_MARCO } from './versao.js';

const $ = (id) => document.getElementById(id);
const app = $('app'), stage = $('stage'), elStatus = $('status'), elHeard = $('heard'), elAnswer = $('answer');
const micBtn = $('mic'), stopBtn = $('stop'), form = $('form'), input = $('text');
const elEstadoChip = $('estadoChip'), tentarBtn = $('tentarDeNovo');
// Modo evento (U6)
const politica = criarPoliticaSessao();
let redeCaiu = typeof navigator !== 'undefined' && navigator.onLine === false;
let guiadasDoPersonagem = [];   // itens da demonstração guiada que o dono aprovou, para o personagem atual
let alertaEvento = false, alertaOrcamento = false;
const avisosEvento = [];
const MAX_CHIPS_GUIADOS = 8; // mais que isso é parede de opções
const LENTO_MS = 12000;       // sem nenhum texto do modelo principal depois disso: plano de reserva
const LENTO_RESERVA_MS = 8000; // o reserva tem menos tempo: no pior caso a criança espera 20 s antes da resposta pronta
let maosLivresAtivo = false, maosLivresPausado = false; // pausado: a pessoa apertou o microfone, então vale o apertar para falar nesta sessão
// RAG (R4). O modelo de embeddings só baixa quando o operador pede "Preparar a base" e há documentos.
const rag = criarRag({ embeddings: criarEmbeddings({ aoProgresso: (pct) => { const e = document.getElementById('ragEstado'); if (e) e.textContent = T.rag.baixandoModelo(pct); } }) });
const elFontes = $('fontes');
let ultimaFalha = null; // a pergunta que não foi respondida, para o botão Tentar de novo
const dlg = $('settings'), keyInput = $('key'), voiceSel = $('voiceSel');
const motorSel = $('motorSel'), urlInput = $('urlKokoro'), modeloInput = $('modelo');
const elStatusVoz = $('statusVoz'), elSeloVoz = $('seloVoz'), bocaSel = $('bocaSel');
const volSlider = $('volSlider'), volMudo = $('volMudo'), volValor = $('volValor'), volIcone = $('volIcone');
// Desenho do alto-falante: com ondas quando há som, cortado quando está no mudo.
// Fica aqui porque mostrarVolume roda durante criarVoz, antes do bloco do volume.
const ICONE_SOM = 'M4 9v6h3.5L12 19V5L7.5 9H4zm11.5-1.3v8.6a4.5 4.5 0 0 0 0-8.6zm0-3.4v2.1a7 7 0 0 1 0 11.2v2.1a9 9 0 0 0 0-15.4z';
const ICONE_MUDO = 'M4 9v6h3.5L12 19V5L7.5 9H4zm15.1 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z';
const elQuadro = $('quadro');
const quadro = criarQuadro(elQuadro);

// Ferramentas que um personagem pode receber (campo ferramentas em characters.js).
const FERRAMENTAS = {
  calcular: { declaracao: DECLARACAO_CALCULAR, executar: (args) => calcular(args.expressao) },
};

// Preferências globais (valem para todos os personagens).
const config = {
  motor: ler('motor', 'auto'),
  urlKokoro: ler('url_kokoro', URL_PADRAO),
  modelo: ler('modelo', MODELO_PADRAO),
  lipsync: ler('lipsync', 'hibrido'),
  volume: Number(ler('volume', '0.8')),
  mudo: ler('mudo', 'nao') === 'sim',
};

// Orçamento (U5): teto acumulado, modelo reserva, modo econômico e proxy local. Lidos na hora, para valer sem recarregar.
const tetoReais = () => Math.max(0, Number(ler('teto_reais', '50')) || 0);
const modeloReserva = () => ler('modelo_reserva', 'gemini-2.5-flash-lite').trim();
const economicoManual = () => ler('modo_economico', 'nao') === 'sim';
const proxyUrl = () => ler('proxy_url', '').trim();

/* ---------- Gemini TTS: uso do dia e telemetria ---------- */
// O gasto de voz fica separado do de texto (custo.js): são modelos, preços e tetos diferentes.
const hojeISO = () => new Date().toISOString().slice(0, 10);
let usoGemini = (() => {
  const salvo = lerJSON('voz_gemini', null);
  return salvo && salvo.dia === hojeISO() ? salvo : { dia: hojeISO(), chamadas: 0, chars: 0, usd: 0, latencias: [] };
})();
const tetoGemini = () => Math.max(0, Number(ler('gt_teto', '20000')) || 0);

config.gemini = {
  get chave() { return apiKey; },
  get modelo() { return ler('gt_modelo', 'gemini-3.8-flash-lite-tts'); },
  get voz() { return ler('gt_voz', 'Kore'); },
  get estilo() { return ler('gt_estilo', ''); },
  // Chamado antes de cada escolha de motor: sem chave ou sem saldo no teto, o app usa outra voz e diz por quê.
  disponivel() {
    if (!apiKey) return { ok: false, aviso: T.vozGemini.semChave };
    const teto = tetoGemini();
    if (teto > 0 && usoGemini.chars >= teto) return { ok: false, aviso: T.vozGemini.teto };
    return { ok: true };
  },
  aoMedir(m) {
    if (usoGemini.dia !== hojeISO()) usoGemini = { dia: hojeISO(), chamadas: 0, chars: 0, usd: 0, latencias: [] };
    usoGemini.chamadas++; usoGemini.chars += m.chars; usoGemini.usd += m.usd || 0;
    usoGemini.latencias.push(m.totalMs);
    if (usoGemini.latencias.length > 50) usoGemini.latencias.shift();
    gravarJSON('voz_gemini', usoGemini);
    custo.somarExtra(m.usd || 0); // a voz paga entra no mesmo teto acumulado
    console.info(`[voz-gemini] ${m.modelo} ${m.voz}: ${m.chars} caracteres, ${m.totalMs} ms para ${m.segundos} s de áudio (${m.tokensSaida} tokens, R$ ${((m.usd || 0) * custo.resumo().cambio).toFixed(5)})`);
    if (typeof desenharUsoGemini === 'function') desenharUsoGemini();
  },
};

const FADE_MS = 160;
const reduzirMovimento = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- Estado ---------- */
let disponiveis = [];        // personagens com .vrm presente, na ordem de PERSONAGENS
let versoes = new Map();     // id -> "tamanho|data" do .vrm (chave do cache da miniatura)
let personagem = null;
let avatar = null;
let diretor = null;          // gestos.js: qual clipe e quando; recriado ao trocar de personagem ou mudar a galeria
const licencas = new Map();     // id do personagem -> resultado de avaliarLicenca (painel e testes)
const registroGestos = [];   // últimos pedidos ignorados ou tocados, para o painel e para os testes
let carga = 0;               // sobe a cada troca; carga antiga que termina depois é descartada
let apiKey = ler('gemini_key');
let ocupado = false, abortCtl = null, falando = false;
let mesa = null;              // mesa de som; só existe depois de criarVoz
let marcaPergunta = null;     // tempos da pergunta em curso (diagnóstico)
const historicos = new Map(); // id -> [{ role, content, contas? }]
// Ajustes do usuário por personagem (persona, temperatura, limite, voz). characters.js fica como padrão.
let ajustes = lerJSON('ajustes_personagens', {});
const efetivo = (p) => aplicarAjustes(p, ajustes);

function historicoDe(id) {
  if (!historicos.has(id)) historicos.set(id, []);
  return historicos.get(id);
}

function definirEstado(s, texto) {
  if (s === 'loading-ear') { micBtn.disabled = true; elStatus.textContent = T.estado.preparandoOuvido; return; }
  app.dataset.state = s;
  // Microfone aberto: o personagem continua audível, mas sai da frente de quem fala.
  if (mesa) mesa.abaixarFundo(s === 'listening');
  elStatus.textContent = texto || (s === 'idle' && maosLivresAtivo ? T.maosLivres.pronto : T.estado[s]);
  elEstadoChip.textContent = T.barra.estados[s] || '';
  elEstadoChip.dataset.estado = s;
  stopBtn.hidden = !(s === 'speaking' || s === 'thinking');
  if ((s === 'idle' || s === 'listening') && avatar) avatar.definirEmocao('neutro'); // a emoção acaba junto com a fala
  tentarBtn.hidden = !(s === 'error' && ultimaFalha);
  if (s === 'idle') micBtn.disabled = false;
}

function estadoOcioso() {
  definirEstado('idle', apiKey ? undefined : T.estado.semChave);
}

/* ---------- Cena ---------- */
let esperaContexto = null;
const cena = criarCena(stage, {
  aoPerderContexto: () => {
    cancelarTudo();
    mostrarAviso(T.quiosque.contextoPerdido);
    // Se o navegador não devolver o contexto, o público fica olhando para um aviso parado.
    clearTimeout(esperaContexto);
    esperaContexto = setTimeout(() => {
      if (!cena.contextoPerdido) return;
      mostrarAviso(T.quiosque.contextoNaoVoltou, () => location.reload());
    }, 8000);
  },
  aoRestaurarContexto: () => {
    clearTimeout(esperaContexto);
    esconderAviso();
    // A GPU perdeu texturas e geometrias: o modelo volta do zero, sem recarregar a página.
    recarregarAvatar();
  },
});
cena.aoAtualizar((dt, t) => {
  const visemas = boca ? boca.ler(dt) : null;
  if (avatar) avatar.atualizar(dt, t, { estado: app.dataset.state, visemas });
});

/* ---------- Diagnóstico e gasto ---------- */
const diagnostico = criarDiagnostico({ cena });
const custo = criarMedidorDeCusto({
  estadoInicial: lerJSON('custo', null),
  cambio: Number(ler('cambio', String(CAMBIO_PADRAO))),
  precos: lerJSON('precos', null),
  aoMudar: () => { gravarJSON('custo', custo.estado); desenharDiagnostico(); atualizarAlertaOrcamento(); },
});

// Vigia do laço de renderização. Num totem sem ninguém olhando, tela congelada só
// sai do ar se o app se recarregar sozinho.
const vigia = criarVigia({
  ultimoQuadro: () => cena.ultimoQuadro,
  aoTravar: () => mostrarAviso(T.quiosque.travou),
  aoDesistir: () => mostrarAviso(T.quiosque.desistiu, () => { esquecerRecargas(); location.reload(); }),
});

const MAPA_PALETA = {
  fundo1: '--fundo-1', fundo2: '--fundo-2', tinta: '--tinta', tintaSuave: '--tinta-suave',
  cartao: '--cartao', acao: '--acao', acaoTinta: '--acao-tinta', acaoSombra: '--acao-sombra', realce: '--realce',
  realceTinta: '--realce-tinta', ok: '--ok', fonte: '--fonte',
};
function aplicarPaleta(p) {
  const raiz = document.documentElement.style;
  for (const [k, v] of Object.entries(MAPA_PALETA)) if (p[k]) raiz.setProperty(v, p[k]);
}

// motivo: texto próprio (ex.: licença); sem motivo, a mensagem padrão de arquivo ausente com o caminho.
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function mostrarErroAvatar(titulo, caminho, motivo = '') {
  $('erroCaminho').textContent = caminho;
  $('erroMotivo').hidden = !motivo;
  $('erroMotivo').textContent = motivo;
  // Com motivo próprio (ex.: licença) a mensagem fica como veio. Arquivo ausente: a criança lê um aviso com saída,
  // e o texto técnico, com o caminho, vai para um bloco que só o adulto abre.
  $('erroTitulo').textContent = motivo ? titulo : T.avatar.criancaTitulo;
  $('erroAjuda').hidden = !!motivo;
  $('erroAjuda').textContent = T.avatar.criancaAjuda;
  $('erroArquivo').hidden = !!motivo;
  $('erroArquivo').open = false;
  $('erroResumo').textContent = T.avatar.paraOAdulto;
  $('erroTecnico').firstChild.textContent = `${titulo} Coloque o arquivo em `;
  $('erroAvatar').hidden = false;
}

// Aviso que cobre a tela do público. Com acao, mostra um botão; sem acao, só espera.
function mostrarAviso({ titulo, texto, acao }, aoClicar) {
  $('avisoTitulo').textContent = titulo;
  $('avisoTexto').textContent = texto;
  const botao = $('avisoAcao');
  botao.hidden = !aoClicar;
  if (aoClicar) {
    botao.textContent = acao || T.quiosque.erro.acao;
    botao.onclick = aoClicar;
  }
  $('avisoQuiosque').hidden = false;
}

function esconderAviso() {
  $('avisoQuiosque').hidden = true;
  $('avisoAcao').onclick = null;
}

/* ---------- Seleção (fase 5, tela B) ---------- */
// Roleta de retratos, personagem vivo sobre o pódio (CSS), cartão com perfil e botão grande.
// Quem aparece ativo é quem tem .vrm e não está marcado emBreve; os demais viram cartão com cadeado.
// Nada aqui desenha personagem: o retrato é render do próprio .vrm (src/avatar.js, gerarMiniatura).
const elSel = {
  raiz: $('selecao'), roleta: $('roleta'), papel: $('selPapel'), nome: $('selNome'), desc: $('selDesc'),
  perfil: $('selPerfil'), ficcao: $('selFiccao'), contador: $('selContador'), ouvir: $('selOuvir'),
  motivo: $('selOuvirMotivo'), conversar: $('selConversar'), ant: $('selAnt'), prox: $('selProx'), vizinhos: $('selVizinhos'),
};
const retratos = new Map(); // id -> url do retrato; o cache durável fica no IndexedDB (src/miniaturas.js)
const NS_SVG = 'http://www.w3.org/2000/svg';
const CADEADO = 'M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z';

function icone(caminho, classe) {
  const svg = document.createElementNS(NS_SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', classe);
  const path = document.createElementNS(NS_SVG, 'path');
  path.setAttribute('d', caminho); path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

function renderizarSelecao() {
  elSel.roleta.replaceChildren(...PERSONAGENS.map((p) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ret'; b.dataset.id = p.id;
    b.setAttribute('role', 'option');
    if (disponiveis.includes(p)) {
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('aria-label', p.nome);
      b.textContent = p.nome[0];
    } else {
      b.disabled = true;
      b.setAttribute('aria-label', T.selecao.emBreveNome(p.nome));
      const r = document.createElement('span'); r.className = 'rotulo-breve'; r.textContent = T.selecao.emBreve;
      b.append(icone(CADEADO, 'cadeado'), r);
    }
    li.append(b);
    return li;
  }));
  elSel.conversar.disabled = true;
  atualizarSelecao();
}

function colocarRetrato(id, url) {
  retratos.set(id, url);
  const b = elSel.roleta.querySelector(`.ret[data-id="${id}"]`);
  if (b) {
    const img = document.createElement('img');
    img.src = url; img.alt = ''; img.width = 120; img.height = 120;
    b.replaceChildren(img);
  }
  atualizarVizinhos();
}

function vizinhosDe(p) {
  const n = disponiveis.length, i = disponiveis.indexOf(p);
  if (n < 2 || i < 0) return null;
  return { ant: disponiveis[(i - 1 + n) % n], prox: disponiveis[(i + 1) % n] };
}

function preencherVizinho(botao, p, rotulo) {
  botao.setAttribute('aria-label', `${rotulo}: ${p.nome}`);
  const nome = document.createElement('span'); nome.textContent = p.nome;
  const url = retratos.get(p.id);
  if (url) {
    const img = document.createElement('img'); img.src = url; img.alt = '';
    botao.replaceChildren(img, nome);
  } else botao.replaceChildren(nome);
  botao.dataset.id = p.id;
}

function atualizarVizinhos() {
  const v = personagem && vizinhosDe(personagem);
  elSel.vizinhos.hidden = !v;
  if (!v) return;
  // Com dois personagens, o anterior e o seguinte são a mesma pessoa: um cartão só.
  elSel.ant.hidden = v.ant === v.prox;
  if (!elSel.ant.hidden) preencherVizinho(elSel.ant, v.ant, T.selecao.anterior);
  preencherVizinho(elSel.prox, v.prox, T.selecao.proximo);
}

function atualizarSelecao() {
  for (const b of elSel.roleta.querySelectorAll('.ret:not(:disabled)')) {
    b.setAttribute('aria-selected', String(!!personagem && b.dataset.id === personagem.id));
  }
  if (!personagem) return;
  const p = personagem;
  desenharVitrine();
  elSel.papel.textContent = p.papel;
  elSel.nome.textContent = p.nome;
  elSel.desc.textContent = p.descricao || '';
  elSel.perfil.replaceChildren(...(p.perfil || []).map((t, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'img');
    li.setAttribute('aria-label', T.selecao.perfilAria(t.rotulo, t.valor));
    const caixa = document.createElement('span'); caixa.className = 'anel-caixa';
    const anel = document.createElement('span'); anel.className = 'anel';
    anel.style.setProperty('--v', String(t.valor)); anel.style.setProperty('--cor', `var(--perfil-${i + 1})`);
    const valor = document.createElement('span'); valor.className = 'anel-valor'; valor.textContent = String(t.valor);
    caixa.append(anel, valor);
    li.append(caixa, t.rotulo);
    return li;
  }));
  elSel.ficcao.textContent = (p.perfil && p.perfil.length) ? T.selecao.ficcao : '';
  const i = disponiveis.indexOf(p) + 1;
  elSel.contador.textContent = `${i}/${disponiveis.length}`;
  elSel.contador.setAttribute('aria-label', T.selecao.contador(i, disponiveis.length));
  elSel.conversar.textContent = T.selecao.conversar(p.nome);
  elSel.conversar.disabled = !avatar || avatar.vrm == null || ocupado;
  elSel.ouvir.textContent = T.selecao.ouvirVoz;
  atualizarOuvir();
  atualizarVizinhos();
  ajustarPalco();
}

// dir: +1 entra pela direita, -1 pela esquerda. Só o CSS usa, para o deslize do canvas.
function irPara(p, dir = 1) {
  if (!p || p === personagem || !disponiveis.includes(p)) return;
  stage.style.setProperty('--dir', String(dir));
  return trocarPersonagem(p);
}

function andar(passo) {
  const v = personagem && vizinhosDe(personagem);
  if (v) irPara(passo > 0 ? v.prox : v.ant, passo > 0 ? 1 : -1);
}

elSel.roleta.addEventListener('click', (e) => {
  const b = e.target.closest('.ret');
  if (!b || b.disabled) return;
  const p = buscarPersonagem(b.dataset.id);
  const dir = disponiveis.indexOf(p) > disponiveis.indexOf(personagem) ? 1 : -1;
  irPara(p, dir);
});
elSel.ant.addEventListener('click', () => andar(-1));
elSel.prox.addEventListener('click', () => andar(1));
elSel.conversar.addEventListener('click', () => { voz.preparar(); iniciarSessao('toque'); });
elSel.raiz.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  const passo = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!passo) return;
  e.preventDefault();
  andar(passo);
});
$('selComoFunciona').addEventListener('click', () => $('comoFunciona').showModal());
$('comoFechar').addEventListener('click', () => $('comoFunciona').close());
$('comoTitulo').textContent = T.selecao.comoTitulo;
$('comoPassos').replaceChildren(...T.selecao.comoPassos.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
$('comoFechar').textContent = T.selecao.fechar;

// Em retrato o palco termina onde o cartão começa. O cartão muda de altura com o texto de cada
// personagem, então a medida é feita de novo a cada troca e a cada mudança de tamanho.
const retrato = matchMedia('(max-aspect-ratio: 5/6)');
function ajustarPalco() {
  if (etapa !== 'selecao' || !retrato.matches) { stage.style.removeProperty('--palco-h'); return; }
  const topo = $('selCartao').getBoundingClientRect().top - app.getBoundingClientRect().top;
  stage.style.setProperty('--palco-h', `${Math.max(240, Math.round(topo - 8))}px`);
}
new ResizeObserver(ajustarPalco).observe(elSel.raiz);
new ResizeObserver(ajustarPalco).observe($('selCartao'));
retrato.addEventListener('change', ajustarPalco);

/* ---------- Vitrine (fase 5, tela A) ---------- */
// Percorre os personagens ativos sozinha, cada um na sua pose de assinatura (o gesto "atracao" do catálogo; sem clipe
// ativo, fica no idle). Sem som: nada toca sozinho. Toque ou rosto levam à seleção (ver os ouvintes do palco).
const elVit = { raiz: $('vitrine'), dica: $('vitDica'), papel: $('vitPapel'), nome: $('vitNome'), frase: $('vitFrase'), pontos: $('vitPontos'), cta: $('vitrineCta') };
// Com ?debug a vitrine só cicla se o tempo foi pedido (vitrine_s): os testes esperam na atração e não podem ver o personagem trocar.
const DEBUG = new URLSearchParams(location.search).has('debug');
const vitrineMs = () => Math.max(3, Number(ler('vitrine_s', DEBUG ? '3600' : '10')) || 10) * 1000;
const selecaoOciosoMs = () => Math.max(10, Number(ler('selecao_ocioso_s', '60')) || 60) * 1000;
let timerVitrine = null, timerPose = null, timerOcioso = null;

elVit.dica.textContent = T.vitrine.dica;
elVit.cta.textContent = T.vitrine.cta;

function desenharVitrine() {
  if (!personagem) return;
  elVit.papel.textContent = personagem.papel;
  elVit.nome.textContent = personagem.nome;
  elVit.frase.textContent = personagem.vitrine || '';
  elVit.pontos.replaceChildren(...disponiveis.map((p) => {
    const li = document.createElement('li');
    if (p === personagem) li.setAttribute('aria-current', 'true');
    return li;
  }));
  elVit.pontos.hidden = disponiveis.length < 2;
}

function pararVitrine() { clearTimeout(timerVitrine); clearTimeout(timerPose); timerVitrine = timerPose = null; }

function iniciarVitrine() {
  pararVitrine();
  desenharVitrine();
  // A pose de assinatura entra um instante depois do personagem aparecer. Gesto sem clipe ativo é ignorado e registrado.
  // Com ?debug e sem vitrine_s pedido, a pose não toca: os testes medem o corpo parado na atração.
  const quietoNoDebug = DEBUG && !ler('vitrine_s', '');
  if (!quietoNoDebug) timerPose = setTimeout(() => { if (etapa === 'atracao' && avatar && !sessaoAtiva) pedirGesto('atracao', 'vitrine'); }, 1800);
  if (disponiveis.length > 1) timerVitrine = setTimeout(avancarVitrine, vitrineMs());
}

async function avancarVitrine() {
  if (etapa !== 'atracao') return;
  const v = personagem && vizinhosDe(personagem);
  if (!v) return;
  await irPara(v.prox, 1);
  if (etapa === 'atracao') iniciarVitrine();
}

// Na escolha, parar um tempo sem tocar em nada devolve a tela à vitrine, para a próxima pessoa.
function tocarOciosoSelecao() {
  clearTimeout(timerOcioso);
  if (etapa === 'selecao') timerOcioso = setTimeout(() => { if (etapa === 'selecao') definirEtapa('atracao'); }, selecaoOciosoMs());
}
for (const alvo of [elSel.raiz, stage]) {
  alvo.addEventListener('pointerdown', tocarOciosoSelecao);
  alvo.addEventListener('keydown', tocarOciosoSelecao);
}
elVit.cta.addEventListener('click', () => { voz.preparar(); if (etapa === 'atracao') definirEtapa('selecao'); });

/* ---------- Ouvir voz ---------- */
// Toca o áudio que já está em cache. Nunca sintetiza na hora, então o botão não gasta orçamento
// nem chama serviço pago, qualquer que seja o motor de voz. Sem áudio guardado, fica desligado e diz por quê.
function motivoSemAudio() {
  if (ultimoMotorVoz && ultimoMotorVoz.direto) return T.selecao.semAudioSistema;
  if (ultimoMotorVoz && ultimoMotorVoz.id === 'gemini') return T.selecao.semAudioPaga;
  if (voz.statusServidor && voz.statusServidor.ok === false) return T.selecao.semAudioServidor;
  return T.selecao.preparandoAudio;
}

function atualizarOuvir() {
  if (!personagem) return;
  const texto = personagem.amostraVoz;
  const pronta = !!texto && voz.temPronta(texto, efetivo(personagem).voz);
  elSel.ouvir.disabled = !pronta;
  elSel.motivo.textContent = pronta ? '' : motivoSemAudio();
}

elSel.ouvir.addEventListener('click', () => {
  if (!personagem) return;
  voz.preparar();
  silenciar();
  voz.tocarPronta(personagem.amostraVoz, efetivo(personagem).voz);
});

// Enquadramento: corpo inteiro na seleção, rosto e ombros nas demais telas. Quem decide é a etapa.
function aplicarEnquadramento(animar) {
  if (!avatar) return;
  cena.definirCorpo(etapa === 'selecao' || etapa === 'atracao' ? avatar.medidaCorpo() : null, animar);
}

// Gera em sequência (um modelo por vez em memória) só os retratos que faltam no cache.
async function prepararMiniaturas() {
  for (const p of disponiveis) {
    const versao = versoes.get(p.id);
    const salvo = await lerMiniatura(p.id, versao);
    if (salvo) { colocarRetrato(p.id, salvo.url); continue; }
    try {
      const url = await gerarMiniatura(p.arquivoVrm, { idle: 'assets/animations/idle.vrma' });
      await gravarMiniatura(p.id, versao, url);
      colocarRetrato(p.id, url);
    } catch (e) {
      console.warn(`[miniatura] ${p.nome}:`, e);
    }
  }
}

/* ---------- Troca de personagem ---------- */
function cancelarTudo() {
  if (abortCtl) abortCtl.abort();
  ouvido.cancelar();
  silenciar();
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Progresso real: 85% são os bytes do .vrm; o resto, montar os movimentos.
function mostrarCarga(texto, fracao) {
  $('cargaTexto').textContent = texto;
  $('cargaBarra').style.transform = `scaleX(${Math.max(0, Math.min(1, fracao))})`;
  $('cargaPct').textContent = `${Math.round(fracao * 100)}%`;
}

async function trocarPersonagem(p) {
  if (personagem === p && avatar) return;
  const minha = ++carga;
  cancelarTudo();

  personagem = p;
  atualizarSelecao(); // texto, perfil e roleta mudam na hora; o modelo chega depois
  atualizarTitulo();
  gravar('personagem', p.id);
  aplicarPaleta(efetivo(p).paleta);
  cena.definirLuz(efetivo(p).luz);
  document.title = `${p.nome} 3D`;
  micBtn.setAttribute('aria-label', T.avatar.falar(p.nome));
  if (etapa === 'atracao') definirEtapa('atracao'); // o convite usa o nome do personagem
  renderizarAtalhos(p.atalhos);
  carregarGuiadas(p).then(atualizarChips);
  voz.resolverMotor(p.voz);
  const hist = historicoDe(p.id);
  const ultima = [...hist].reverse().find((m) => m.role === 'assistant');
  elHeard.textContent = '';
  elAnswer.textContent = ultima ? separarFalaEQuadro(ultima.content).fala : p.saudacao;
  mostrarQuadroDe(p, hist);
  estadoOcioso();

  stage.classList.add('trocando');
  if (!reduzirMovimento.matches) await esperar(FADE_MS);
  if (minha !== carga) return;
  if (avatar) { avatar.descartar(); avatar = null; }
  $('erroAvatar').hidden = true;
  mostrarCarga(T.carga.baixando(p.nome), 0);
  $('loading').hidden = false;

  try {
    const { vrm, bytes } = await carregarVrm(p.arquivoVrm, { aoProgresso: (f) => { if (minha === carga) mostrarCarga(T.carga.baixando(p.nome), f * 0.85); } });
    if (minha === carga) mostrarCarga(T.carga.movimentos, 0.9);
    // Licença lida dos metadados do próprio arquivo. Bloqueado: não aparece para o público.
    const lic = avaliarLicenca(vrm.meta);
    licencas.set(p.id, lic);
    console.info(`[licença] ${p.nome} (${p.arquivoVrm}): ${lic.decisao} | ${lic.titulo} | ${lic.autor} | ${lic.licenca}` +
      (lic.bloqueio.length || lic.conferir.length ? ' | ' + [...lic.bloqueio, ...lic.conferir].join('; ') : ''));
    if (lic.decisao === 'bloqueado') {
      descartarVrm(vrm);
      if (minha === carga) mostrarErroAvatar(T.licenca.bloqueado(p.nome), p.arquivoVrm, maiuscula(lic.bloqueio.join('; ')) + '.');
      return;
    }
    if (minha !== carga) { descartarVrm(vrm); return; }
    diretor = novoDiretor(p);
    const bases = {};
    for (const e of ESTADOS_BASE) { const c = diretor.clipeBase(e); if (c) bases[e] = await clipeDoArquivo(c.arquivo, vrm); }
    if (minha !== carga) { descartarVrm(vrm); return; }
    registrarChecklist(p.nome, checarVrm(vrm, bytes));
    avatar = montarAvatar(vrm, cena, { bases, tetoBoca: p.tetoBoca, fixarNoLugar });
    cena.definirFoco(avatar.posicaoCabeca, efetivo(p).enquadramento);
    aplicarEnquadramento(false); // na seleção troca para corpo inteiro; o deslize é do canvas, não da câmera
    atualizarSelecao();
    if (visualizador.ativo) { cena.resetarCamera(0); visualizador.aoTrocarPersonagem(); }
    // Gestos ativos já ficam prontos, para o primeiro aceno não esperar o download.
    await Promise.all(diretor.gestosValidos().flatMap((g) => diretor.clipesDe(g)).map((c) => clipeDoArquivo(c.arquivo, vrm)));
    if (minha !== carga) return;
    if (sessaoAtiva) pedirGesto('aceno', 'fluxo');
    // Cumprimento e despedida já sintetizados: a fala sai ~300 ms depois do aceno, sem esperar o Kokoro.
    prepararFrasesFixas(p);
  } catch (e) {
    if (minha !== carga) return;
    console.error(`[avatar] ${p.nome}:`, e);
    if (e instanceof AvatarAusenteError) mostrarErroAvatar(T.avatar.ausente(p.nome), p.arquivoVrm);
    else mostrarErroAvatar(T.avatar.naoAbriu(p.nome), p.arquivoVrm);
  } finally {
    if (minha === carga) {
      $('loading').hidden = true;
      stage.classList.remove('trocando');
    }
  }
}

// Monta de novo o personagem que já está em cena (depois de perder o contexto WebGL).
// Zerar `personagem` é o que faz a troca refazer tudo em vez de sair pela porta de entrada.
function recarregarAvatar() {
  const p = personagem;
  if (!p) return Promise.resolve();
  personagem = null;
  return trocarPersonagem(p);
}

// Redesenha o quadro com a última resposta do personagem (linhas e contas guardadas no histórico).
function mostrarQuadroDe(p, hist) {
  elQuadro.hidden = !p.quadro;
  if (!p.quadro) return;
  const idx = hist.map((m) => m.role).lastIndexOf('assistant');
  quadro.limpar(idx > 0 ? hist[idx - 1].content : '');
  if (idx < 0) return;
  for (const c of hist[idx].contas || []) quadro.adicionarConta(c);
  for (const linha of separarFalaEQuadro(hist[idx].content).quadro) quadro.adicionarLinha(linha);
}



async function carregarGuiadas(p) {
  try { guiadasDoPersonagem = itensAprovados(await rag.guiadasDe(p.id)); } catch (e) { console.warn('[evento] guiadas não carregaram:', e); guiadasDoPersonagem = []; }
}
// Na demonstração guiada, com respostas aprovadas, os atalhos viram as perguntas guiadas (resposta pronta, sem Gemini).
function atualizarChips() {
  if (!personagem) return;
  if (app.dataset.modo === 'guiada' && guiadasDoPersonagem.length) {
    $('chips').replaceChildren(...guiadasDoPersonagem.slice(0, MAX_CHIPS_GUIADOS).map((g, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.guiada = String(i); b.textContent = g.pergunta; b.title = g.pergunta;
      return b;
    }));
  } else renderizarAtalhos(personagem.atalhos);
}
function renderizarAtalhos(atalhos) {
  $('chips').replaceChildren(...atalhos.map((a) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.q = a.pergunta; b.textContent = a.rotulo;
    return b;
  }));
}

/* ---------- Voz ---------- */
const voz = criarVoz({
  config,
  volumeInicial: config.volume,
  mudoInicial: config.mudo,
  aoMudarMesa: (m) => mostrarVolume(m),
  aoComecarFala: () => { falando = true; if (marcaPergunta) marcaPergunta.aoPrimeiraFala(); definirEstado('speaking'); },
  aoTerminarFala: () => { falando = false; if (!ocupado) estadoOcioso(); liberarGesto(); tocarInatividade(); avancarDepoisDaFala(); verificarPolitica(); },
  aoFimFrase: () => liberarGesto(),
  // Gesto marcado pelo LLM numa sentença: pedido no instante em que essa sentença começa a tocar.
  aoInicioFrase: (gestos, emocao) => {
    if (emocao && avatar) avatar.definirEmocao(emocao);
    for (const g of gestos) pedirGesto(g, 'llm', { naFronteira: true });
  },
  aoPalavra: () => { if (boca) boca.marcarPalavra(); },
  aoStatus: mostrarStatusVoz,
  aoMudarVozesSistema: (vozes, manual) => {
    const auto = document.createElement('option');
    auto.value = ''; auto.textContent = T.voz.automatica;
    voiceSel.replaceChildren(auto, ...vozes.map((v) => {
      const o = document.createElement('option'); o.value = v.name; o.textContent = `${v.name} (${v.lang})`; return o;
    }));
    voiceSel.value = manual ? manual.name : '';
  },
  aoProgressoNavegador: (pct) => { elStatusVoz.textContent = T.voz.baixandoModelo(pct); },
});
mesa = voz.mesa;
function silenciar() { voz.parar(); falando = false; }

/* ---------- Volume ---------- */
// Vem da mesa, não do evento: o estado mostrado é sempre o que está tocando.
function mostrarVolume({ volume, mudo }) {
  const pct = Math.round(volume * 100);
  if (document.activeElement !== volSlider) volSlider.value = String(pct);
  volValor.textContent = mudo ? T.volume.mudo : `${pct}%`;
  volMudo.setAttribute('aria-pressed', mudo ? 'true' : 'false');
  volMudo.setAttribute('aria-label', mudo ? T.volume.religar : T.volume.mudar);
  volIcone.firstElementChild.setAttribute('d', mudo ? ICONE_MUDO : ICONE_SOM);
}

volSlider.addEventListener('input', () => {
  voz.preparar();
  mesa.definirVolume(Number(volSlider.value) / 100);
  gravar('volume', String(mesa.volume));
  gravar('mudo', mesa.mudo ? 'sim' : 'nao');
});
volMudo.addEventListener('click', () => {
  voz.preparar();
  mesa.alternarMudo();
  gravar('mudo', mesa.mudo ? 'sim' : 'nao');
});
const boca = criarBoca({ ctx: voz.ctx, analisador: voz.analisador, saida: voz.saida, modo: config.lipsync });

// Selo no palco + linha de estado nas configurações.
let ultimoMotorVoz = null; // só para o painel de diagnóstico, que não pode ter efeito colateral
let ultimoAvisoVoz = null;
function mostrarStatusVoz({ motor, aviso, servidor }) {
  ultimoMotorVoz = motor;
  if (aviso && aviso !== ultimoAvisoVoz) avisarOperador(aviso);
  ultimoAvisoVoz = aviso || null;
  atualizarOuvir(); // sem personagem ainda, ela sai na primeira linha
  const s = servidor || {};
  const natural = motor && motor.id === 'webspeech' && motor.temNatural;
  const sel = T.voz.selo;
  let selo = motor ? (natural ? sel.edge : motor.id === 'webspeech' ? sel.sistema : motor.id === 'kokoro-browser' ? sel.navegador : sel.kokoro) : sel.verificando;
  if (motor && motor.id === 'gemini') selo = sel.gemini;
  if (aviso) selo = aviso.startsWith('Servidor') ? sel.servidorFora : (motor && motor.id !== 'webspeech' ? sel.reserva(selo) : sel.sistema);
  elSeloVoz.textContent = selo;
  elSeloVoz.dataset.alerta = aviso ? 'sim' : 'nao';
  const linhaServidor = s.ok === true ? T.voz.servidorOk(s.detalhe) : s.ok === false ? T.voz.servidorRuim(s.detalhe) : T.voz.verificando;
  elStatusVoz.textContent = aviso ? `${linhaServidor} ${aviso}` : linhaServidor;
}

/* ---------- Gestos ---------- */
const modoCalmo = () => reduzirMovimento.matches || ler('modo_calmo', 'nao') === 'sim';
const fixarNoLugar = () => ler('fixar_lugar', 'sim') === 'sim';
// O operador pode apontar um gesto para um movimento enviado ("usar como aceno"); vale por cima do catálogo.
const mapaEfetivo = () => ({ ...catalogo.estados, ...lerJSON('estados_extra', {}) });
function anotarGesto(msg) {
  registroGestos.push({ t: Math.round(performance.now()), msg });
  if (registroGestos.length > 50) registroGestos.shift();
  console.info('[gestos] ' + msg);
}
function novoDiretor(p) {
  if (!catalogo) return criarDiretor({ clipes: [], mapa: {}, registrar: anotarGesto });
  return criarDiretor({
    clipes: aplicarEscolhas(catalogo), mapa: mapaEfetivo(), inventario: p.gestos || null,
    intervaloMinS: Number(ler('intervalo_gestos', String(catalogo.intervaloMinS ?? 8))), calmo: modoCalmo,
    infantil: () => ler('modo_infantil', 'sim') === 'sim', registrar: anotarGesto,
  });
}
async function executarGesto(c, origem, aoComecar = null) {
  if (!avatar) return;
  const alvo = avatar;
  const clipe = await clipeDoArquivo(c.arquivo, alvo.vrm);
  if (!clipe || alvo !== avatar) { anotarGesto(`não tocou "${c.id}": arquivo não abriu`); return; }
  const d = diretor;
  if (alvo.tocarGesto(clipe, () => d.terminou())) {
    anotarGesto(`tocou "${c.id}" (${origem})`);
    if (aoComecar) aoComecar(performance.now());
  }
  else d.terminou();
}
// origem: 'fluxo', 'llm', 'evento', 'operador'. Durante a fala, o diretor segura até a fronteira da sentença.
function pedirGesto(nome, origem = 'evento', { naFronteira = false, aoComecar = null } = {}) {
  if (!diretor || !avatar) return null;
  const r = diretor.pedir(nome, { origem, falando: !naFronteira && voz.falando });
  if (r.clipe) executarGesto(r.clipe, origem, aoComecar);
  else if (r.esperando) anotarGesto(`"${nome}" espera o fim da sentença`);
  return r;
}
function liberarGesto() {
  const c = diretor && diretor.fronteira();
  if (c) executarGesto(c, 'fronteira');
}

/* ---------- Fluxo de sessão (P5) ---------- */
// atracao -> cumprimento -> consentimento -> conversa -> despedida -> (limpeza) -> atracao.
// Cada etapa mostra um único próximo passo. O microfone começa desligado e só existe se a pessoa aceitar.
const elPasso = { caixa: $('passo'), titulo: $('passoTitulo'), texto: $('passoTexto'), nota: $('passoNota'), acao: $('passoAcao'), alt: $('passoAlt') };
const usarVozBtn = $('usarVoz');
let etapa = 'atracao', microfone = null, timerEtapa = null; // microfone: null (não perguntado), 'sim', 'nao'

// Título da tela para leitor de tela (o único h1 da página). Muda a cada etapa e a cada personagem.
function atualizarTitulo() {
  const nome = personagem ? personagem.nome : '';
  const v = visualizador.ativo;
  $('tituloPagina').textContent = v ? T.titulos.visualizador(nome)
    : etapa === 'atracao' ? T.titulos.atracao
    : etapa === 'selecao' ? T.titulos.selecao
    : etapa === 'consentimento' ? T.titulos.consentimento(nome)
    : T.titulos.conversa(nome);
}

function definirEtapa(e) {
  // Um visualizador aberto não pode ficar por cima de uma tela que mudou sozinha (despedida por inatividade, rosto novo).
  if (visualizador.ativo && e !== 'conversa') visualizador.sair();
  etapa = e;
  app.dataset.etapa = e;
  atualizarTitulo();
  elSel.raiz.hidden = e !== 'selecao';
  elVit.raiz.hidden = e !== 'atracao';
  if (e === 'selecao') atualizarSelecao();
  if (e === 'atracao') iniciarVitrine(); else pararVitrine();
  tocarOciosoSelecao();
  aplicarEnquadramento(true);
  cena.orbitaAutomatica(e === 'cumprimento' || e === 'conversa');
  clearTimeout(timerEtapa);
  app.dataset.microfone = microfone === 'sim' ? 'sim' : 'nao';
  usarVozBtn.hidden = !(e === 'conversa' && microfone === 'nao');
  usarVozBtn.textContent = T.etapas.conversa.mudarParaVoz;
  const p = personagem ? personagem.nome : '';
  if (e === 'consentimento') {
    const c = T.etapas.consentimento;
    mostrarPasso(c.titulo, c.texto, camera.ligada ? c.camLigada : c.camDesligada, c.acao, c.alternativa);
  } else {
    elPasso.caixa.hidden = true;
  }
  // Etapas que esperam o fim de uma fala têm um limite, para nunca travarem sem voz.
  if (typeof atualizarMaosLivres === 'function') atualizarMaosLivres();
  if (e === 'cumprimento') timerEtapa = setTimeout(() => { if (etapa === 'cumprimento') definirEtapa(microfone ? 'conversa' : 'consentimento'); }, 8000);
  if (e === 'despedida') timerEtapa = setTimeout(() => { if (etapa === 'despedida') voltarParaAtracao(); }, 8000);
}

function mostrarPasso(titulo, texto, nota, acao, alt) {
  elPasso.titulo.textContent = titulo;
  elPasso.texto.textContent = texto;
  elPasso.nota.textContent = nota;
  elPasso.nota.hidden = !nota;
  elPasso.acao.textContent = acao;
  elPasso.alt.textContent = alt || '';
  elPasso.alt.hidden = !alt;
  elPasso.caixa.hidden = false;
}

// Chamado quando uma fala termina (aoTerminarFala).
function avancarDepoisDaFala() {
  if (etapa === 'cumprimento') definirEtapa(microfone ? 'conversa' : 'consentimento');
  else if (etapa === 'despedida') voltarParaAtracao();
}

function voltarParaAtracao() {
  microfone = null; // a próxima pessoa responde de novo
  elHeard.textContent = '';
  elAnswer.textContent = '';
  definirEtapa('atracao');
}

elPasso.acao.addEventListener('click', () => {
  voz.preparar();
  if (etapa === 'atracao') definirEtapa('selecao');
  else if (etapa === 'consentimento') { microfone = 'sim'; definirEtapa('conversa'); micBtn.focus(); }
});
elPasso.alt.addEventListener('click', () => {
  if (etapa !== 'consentimento') return;
  microfone = 'nao';
  definirEtapa('conversa');
  input.focus();
});
usarVozBtn.addEventListener('click', () => { microfone = 'sim'; definirEtapa('conversa'); micBtn.focus(); });

/* ---------- Sessão: cumprimento e despedida ---------- */
// Começa com rosto detectado após ausência, toque na tela ou botão do operador.
// Termina pelo operador ou por inatividade: aceno, frase curta e limpeza do histórico.
const ATRASO_FALA_MS = 300;
const inatividadeS = () => Number(ler('inatividade_s', '90'));
let sessaoAtiva = false, timerInatividade = null;
const medidasSessao = []; // { tipo, origem, gatilho, gesto } em ms (performance.now), para o painel e os testes

function tocarInatividade() {
  clearTimeout(timerInatividade);
  if (!sessaoAtiva) return;
  timerInatividade = setTimeout(() => {
    // Falar, pensar ou ouvir é estar usando: só fecha quando tudo está parado.
    if (ocupado || voz.falando || ouvido.gravando) { tocarInatividade(); return; }
    encerrarSessao('inatividade');
  }, inatividadeS() * 1000);
}
// Qualquer toque, tecla, roda ou texto digitado conta como presença: quem escreve, lê ou gira a câmera não saiu.
for (const ev of ['pointerdown', 'keydown', 'wheel', 'input']) {
  document.addEventListener(ev, () => { if (sessaoAtiva) tocarInatividade(); }, { capture: true, passive: true });
}

function acenarEFalar(tipo, origem, frase) {
  const gatilho = performance.now();
  const m = { tipo, origem, gatilho, gesto: null };
  medidasSessao.push(m);
  if (medidasSessao.length > 50) medidasSessao.shift();
  const r = pedirGesto(tipo === 'despedida' ? 'despedida' : 'aceno', 'fluxo', { aoComecar: (t) => { m.gesto = t; } });
  if (!frase) return;
  const ef = efetivo(personagem);
  // A fala vem logo depois do braço começar a subir, não antes.
  setTimeout(() => {
    if (!personagem) return;
    elHeard.textContent = '';
    elAnswer.textContent = frase;
    voz.falarTexto(frase, ef.voz);
  }, r && r.clipe ? ATRASO_FALA_MS : 0);
}

function prepararFrasesFixas(p) {
  const ef = efetivo(p);
  Promise.all([ef.oiPresenca, ef.despedida, p.amostraVoz].filter(Boolean).map((f) => voz.preSintetizar(f, ef.voz)))
    .then(() => { if (personagem === p) atualizarOuvir(); });
}

function iniciarSessao(origem) {
  if (sessaoAtiva || !personagem || !avatar || ocupado) return false;
  sessaoAtiva = true;
  app.dataset.sessao = 'ativa';
  politica.iniciar();
  definirEtapa('cumprimento');
  acenarEFalar('cumprimento', origem, efetivo(personagem).oiPresenca);
  tocarInatividade();
  return true;
}

// Limite de perguntas ou de tempo: a sessão termina com a despedida normal, depois de a fala em curso acabar.
function verificarPolitica() {
  if (!sessaoAtiva || ocupado || falando) return;
  const e = politica.estado();
  if (!e.motivo) return;
  avisarOperador(e.motivo === 'turnos' ? T.evento.aviso.limiteTurnos : T.evento.aviso.limiteTempo);
  encerrarSessao('limite-' + e.motivo);
}
setInterval(verificarPolitica, 5000);

function encerrarSessao(origem) {
  if (!sessaoAtiva || !personagem) return false;
  sessaoAtiva = false;
  politica.parar();
  maosLivresPausado = false;
  app.dataset.sessao = 'encerrada';
  clearTimeout(timerInatividade);
  if (abortCtl) abortCtl.abort();
  silenciar();
  limparConversa();
  definirEtapa('despedida');
  acenarEFalar('despedida', origem, efetivo(personagem).despedida);
  return true;
}

// Nada da conversa anterior pode sobrar para a próxima pessoa: histórico, quadro, microfone aberto, menu e legenda.
// O microfone importa: sem cancelar, o reconhecimento termina depois e abre uma pergunta nova em cima da vitrine.
function limparConversa() {
  ultimaFalha = null;
  ouvido.cancelar();
  for (const h of historicos.values()) h.length = 0;
  quadro.limpar('');
  if (personagem && personagem.quadro) mostrarQuadroDe(personagem, historicoDe(personagem.id));
  input.value = '';
  fecharMenu();
  elLegenda.raiz.hidden = true;
}

// Sair do personagem sem despedida: volta à escolha na hora.
function escolherOutroPersonagem() {
  clearTimeout(timerInatividade);
  sessaoAtiva = false;
  app.dataset.sessao = 'encerrada';
  if (abortCtl) abortCtl.abort();
  silenciar();
  limparConversa();
  elHeard.textContent = ''; elAnswer.textContent = '';
  microfone = null;
  estadoOcioso();
  definirEtapa('selecao');
}

// Duplo clique ou duplo toque no personagem centraliza a câmera. O visualizador tem o seu próprio.
let ultimoToqueCam = 0;
const naTelaDaConversa = (e) => (etapa === 'conversa' || etapa === 'cumprimento') && !visualizador.ativo && e.target === cena.renderer.domElement;
stage.addEventListener('dblclick', (e) => { if (naTelaDaConversa(e)) cena.resetarCamera(reduzirMovimento.matches ? 0 : 500); });
stage.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || !naTelaDaConversa(e)) return;
  const agora = performance.now();
  if (agora - ultimoToqueCam < 350) { cena.resetarCamera(reduzirMovimento.matches ? 0 : 500); ultimoToqueCam = 0; } else ultimoToqueCam = agora;
});

let toqueX = null, toqueId = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, input, select, textarea, form, a, .quadro')) return;
  voz.preparar();
  if (etapa === 'atracao') definirEtapa('selecao');
  else if (etapa === 'selecao') {
    // Um segundo dedo no meio do deslize cancela o gesto em vez de saltar para o novo ponto.
    if (toqueId !== null && e.pointerId !== toqueId) { toqueX = null; toqueId = null; return; }
    toqueX = e.clientX; toqueId = e.pointerId;
  }
});
// Deslizar o dedo no palco troca de personagem na seleção.
stage.addEventListener('pointerup', (e) => {
  if (toqueX === null || e.pointerId !== toqueId) return;
  const dx = e.clientX - toqueX;
  toqueX = null; toqueId = null;
  if (etapa === 'selecao' && Math.abs(dx) > 60) andar(dx < 0 ? 1 : -1);
});
const largarToque = () => { toqueX = null; toqueId = null; };
stage.addEventListener('pointercancel', largarToque);
stage.addEventListener('lostpointercapture', largarToque);
window.addEventListener('blur', largarToque);

/* ---------- Pergunta ---------- */
async function perguntarAoPersonagem(q) {
  q = (q || '').trim();
  if (!q || ocupado || !personagem) return;
  ultimaFalha = null;
  politica.contarTurno();
  if (!sessaoAtiva) { sessaoAtiva = true; app.dataset.sessao = 'ativa'; }
  if (etapa !== 'conversa') definirEtapa('conversa');
  tocarInatividade();
  if (!apiKey && !proxyUrl() && !modoEconomicoAtivo()) { definirEstado('idle', T.estado.semChave); abrirConfiguracoes(); return; }
  const quem = personagem;
  const marca = diagnostico.marcarPergunta();
  marcaPergunta = marca;
  const ef = efetivo(quem);
  const hist = historicoDe(quem.id);
  silenciar(); ocupado = true;
  elHeard.textContent = T.estado.voce(q);
  elAnswer.textContent = '';
  elFontes.hidden = true; elFontes.textContent = '';
  definirEstado('thinking');
  if (ef.quadro) { elQuadro.hidden = false; quadro.limpar(q); }
  const contas = [];
  hist.push({ role: 'user', content: q });
  const ctl = new AbortController();
  abortCtl = ctl;
  // Base de conhecimento (R4): só consulta quando o índice deste personagem está pronto. Falha na busca não derruba a pergunta.
  let rg = null, rgBruto = null; // rgBruto: o resultado da busca antes da regra do modo complemento, para a resposta pronta
  let regraDoTema = false; // pergunta do assunto da base: só pode ser respondida com ela
  if (rag.pronto(quem.id)) {
    try {
      rg = await rag.consultar(quem.id, q);
      regraDoTema = await rag.ehDoTema(quem.id, q);
      rgBruto = rg;
    } catch (e) { console.warn('[rag] consulta falhou, segue sem a base:', e); }
    // Modo complemento: a base só entra quando a pergunta cita termos do assunto dela (regex derivado dos documentos, em
    // knowledge/index.json). Semelhança alta sozinha não basta: "por que o céu é azul?" passou do limiar com um trecho da UEMA.
    const complemento = (ef.conhecimento && ef.conhecimento.modo) === 'complemento';
    if (rg && complemento && !regraDoTema) rg = null;
  }
  // Servidor fora do ar na última checagem? Tenta de novo rápido antes de cair para a voz do sistema.
  if (config.motor !== 'webspeech' && voz.statusServidor.ok !== true) await voz.verificarServidor({ timeoutMs: 800 });
  const falaTurno = voz.novoTurno(ef.voz);
  const divisor = criarDivisor();
  let falado = '';
  // Teo/Rafa: as linhas "QUADRO:" vão para o quadro; o resto é falado. Demais: tudo é falado.
  const falar = (pedaco) => {
    if (ctl.signal.aborted) return;
    falado += pedaco;
    elAnswer.textContent = removerMarcas(limparParaFala(falado)).trim();
    for (const f of divisor.adicionar(pedaco)) falaTurno.adicionar(f);
  };
  const leitor = ef.quadro
    ? criarLeitorMarcado({ aoFala: falar, aoQuadro: (l) => { if (!ctl.signal.aborted) quadro.adicionarLinha(removerMarcas(l)); } })
    : null;
  try {
    let texto;
    // Resposta pronta da base (U5/U6): sem chamar o Gemini. Usa o trecho mais próximo, com a fonte, só se a busca for confiante.
    const prontaDaBase = (motivo) => {
      marca.aoPrimeiroTexto();
      if (rgBruto && rgBruto.confiante && rgBruto.resultados.length) {
        rg = rgBruto;
        const t0 = rgBruto.resultados[0];
        const palavras = t0.texto.split(/\s+/);
        return palavras.length > 50 ? palavras.slice(0, 50).join(' ') + '.' : t0.texto;
      }
      return motivo === 'orcamento' ? T.orcamento.semBase : T.resposta.semInternet;
    };
    // Se o Gemini não mandar nenhum texto em limiteMs, desiste e segue a cadeia. Atividade (texto ou ferramenta) zera a espera.
    const chamar = (modeloUsado, limiteMs = LENTO_MS) => {
      const sub = new AbortController();
      let lento = false, timer = null;
      const cancelar = () => sub.abort();
      ctl.signal.addEventListener('abort', cancelar, { once: true });
      const armar = () => { clearTimeout(timer); timer = setTimeout(() => { lento = true; sub.abort(); }, limiteMs); };
      armar();
      return perguntarEmFluxo({
        apiKey, proxy: proxyUrl(), modelo: modeloUsado, persona: ef.persona + instrucaoGestos(diretor ? diretor.gestosValidos() : []) + instrucaoEmocao() + (rg ? instrucaoRag(rg.resultados) : ''), historico: hist.slice(-9), signal: sub.signal,
        temperatura: ef.temperatura, limitePalavras: ef.limitePalavras,
        ferramentas: Object.fromEntries((ef.ferramentas || []).filter((n) => FERRAMENTAS[n]).map((n) => [n, FERRAMENTAS[n]])),
        aoChamada: (nome, args, resultado) => {
          armar();
          if (nome !== 'calcular' || ctl.signal.aborted) return;
          contas.push(resultado);
          quadro.adicionarConta(resultado);
        },
        aoTexto: (pedaco) => { clearTimeout(timer); marca.aoPrimeiroTexto(); return leitor ? leitor.adicionar(pedaco) : falar(pedaco); },
        aoUso: (uso) => custo.somar(modeloUsado, uso),
      }).catch((e) => {
        if (lento && !ctl.signal.aborted) { avisarOperador(T.evento.aviso.lento); throw new ErroGemini(504, 'sem resposta em ' + limiteMs + ' ms'); }
        throw e;
      }).finally(() => { clearTimeout(timer); ctl.signal.removeEventListener('abort', cancelar); });
    };
    // Falha que vale tentar o reserva ou a resposta pronta: cota, servidor fora, queda de rede. Nunca depois de já ter falado.
    const tentavel = (e) => !falado && e.name !== 'AbortError' && (e instanceof ErroGemini ? [401, 403, 404, 429, 500, 502, 503, 504].includes(e.status) : true);
    const tetoDoProxy = (e) => e instanceof ErroGemini && e.status === 429 && /teto/i.test(e.detalhe || '');
    if (modoEconomicoAtivo()) {
      texto = prontaDaBase('orcamento');
      falar(texto);
    } else if (rg && !rg.confiante) {
      // A base não cobre a pergunta: resposta pronta, sem chamar o Gemini (custo zero) e sem inventar.
      marca.aoPrimeiroTexto();
      texto = regraDoTema ? T.rag.naoSeiTema(quem.nome) : T.rag.naoSei(quem.nome);
      falar(texto);
    } else {
      // Cadeia: modelo principal, depois o reserva mais barato, depois a resposta pronta da base.
      try {
        texto = await chamar(config.modelo);
      } catch (e1) {
        if (!tentavel(e1)) throw e1;
        const reserva = modeloReserva();
        try {
          if ([401, 403].includes(e1.status)) avisarOperador(T.evento.aviso.chaveRecusada);
          if (e1.status === 404) avisarOperador(T.evento.aviso.modeloNaoExiste(config.modelo));
          if (tetoDoProxy(e1) || [401, 403].includes(e1.status) || !reserva || reserva === config.modelo) throw e1; // a mesma chave recusada ou o mesmo teto valem para o reserva
          console.warn(`[gemini] ${config.modelo} falhou (${e1.status || e1.message}); tentando o reserva ${reserva}`);
          texto = await chamar(reserva, LENTO_RESERVA_MS);
          avisarOperador(T.evento.aviso.reserva);
        } catch (e2) {
          if (!tentavel(e2) || !(rgBruto && rgBruto.confiante)) throw e2;
          console.warn('[gemini] reserva também falhou; resposta pronta da base:', e2);
          avisarOperador(T.evento.aviso.pronta);
          texto = prontaDaBase('falha');
          falar(texto);
        }
      }
    }
    if (leitor) leitor.finalizar();
    for (const f of divisor.finalizar()) falaTurno.adicionar(f);
    falaTurno.finalizar();
    if (personagem !== quem) { hist.pop(); return; }
    if (!texto) { hist.pop(); elAnswer.textContent = T.resposta.vazia; return; }
    if (rg && rg.confiante) {
      const lista = fontesCitadas(texto, rg.resultados);
      const usados = lista.length ? lista : rg.resultados.slice(0, 2);
      elFontes.textContent = T.rag.fontes(usados.map((t) => `${t.titulo}, ${t.secao} (${t.fonte || t.id})`));
      elFontes.hidden = false;
    }
    hist.push({ role: 'assistant', content: texto.replace(/\[(gesto|emo|fonte):[^\]]*\]\s*/gi, ''), contas });
    elAnswer.textContent = removerMarcas(limparParaFala(falado)).trim() || separarFalaEQuadro(hist[hist.length - 1].content).fala;
  } catch (e) {
    hist.pop();
    falaTurno.finalizar();
    if (e.name === 'AbortError') return;
    silenciar();
    console.error('[gemini]', e, e.detalhe || '');
    if (e instanceof ErroGemini) {
      // O 400 também acontece com chave válida quando a requisição tem algo que o modelo recusa.
      const motivo = (() => { try { return JSON.parse(e.detalhe).error.message; } catch (x) { return (e.detalhe || '').slice(0, 200); } })();
      elAnswer.textContent = [401, 403].includes(e.status) ? T.resposta.chaveRecusada
        : e.status === 400 ? T.resposta.recusado(motivo)
        : e.status === 404 ? T.resposta.modeloNaoExiste(config.modelo)
        : e.status === 429 ? T.resposta.muitasPerguntas
        : T.resposta.erroHttp(e.status);
    } else {
      elAnswer.textContent = T.resposta.semInternet;
    }
    // O erro vira estado de verdade (sinal "Problema") e a pergunta fica guardada para o botão Tentar de novo.
    ultimaFalha = q;
    definirEstado('error');
  } finally {
    ocupado = false;
    if (abortCtl === ctl) abortCtl = null;
    if (!voz.emTurno && personagem === quem && app.dataset.state === 'thinking') estadoOcioso();
  }
}

tentarBtn.textContent = T.estado.tentarDeNovo;
tentarBtn.addEventListener('click', () => {
  const q = ultimaFalha;
  ultimaFalha = null;
  estadoOcioso();
  if (q) perguntarAoPersonagem(q);
});

// Demonstração guiada (U6): resposta pronta e aprovada, sem Gemini, sem custo e sem internet. O áudio vem do disco quando já foi gerado.
async function responderGuiada(item) {
  if (!item || ocupado || !personagem) return;
  ultimaFalha = null;
  politica.contarTurno();
  if (!sessaoAtiva) { sessaoAtiva = true; app.dataset.sessao = 'ativa'; }
  if (etapa !== 'conversa') definirEtapa('conversa');
  tocarInatividade();
  const quem = personagem, ef = efetivo(quem);
  silenciar();
  elHeard.textContent = T.estado.voce(item.pergunta);
  elAnswer.textContent = item.resposta;
  elFontes.textContent = T.rag.fontes([item.fonte || T.evento.guiadaResposta]); elFontes.hidden = false;
  const marca = diagnostico.marcarPergunta(); marca.aoPrimeiroTexto();
  await voz.preSintetizar(item.resposta, ef.voz); // lê do disco ou sintetiza (só voz gratuita), para tocar na hora
  if (personagem !== quem) return;
  voz.falarTexto(item.resposta, ef.voz);
}

/* ---------- Ouvido ---------- */
const ouvido = criarOuvido({
  // Mãos-livres: falar por cima do personagem corta a fala e a requisição na hora e passa a ouvir.
  aoInterromper: () => { if (abortCtl) abortCtl.abort(); silenciar(); },
  aoTranscricao: (ms) => diagnostico.registrarTranscricao(ms),
  aoOuvirParcial: (t) => { elHeard.textContent = T.estado.voce(t); },
  aoOuvirFinal: (t) => perguntarAoPersonagem(t),
  aoMudarEstado: definirEstado,
  aoProgresso: (pct) => { elStatus.textContent = T.estado.preparandoOuvidoPct(pct); },
});

/* ---------- Barra de comando ---------- */
// "+" abre um menu pequeno; Guiada deixa só as perguntas sugeridas; o sinal de estado tem legenda própria.
// Guiada aqui NÃO é a demonstração offline com áudios pré-gravados do REPERTORIO 24: essa não existe ainda.
// As perguntas sugeridas continuam indo ao Gemini.
const elMais = { btn: $('maisBtn'), menu: $('maisMenu') };
const elLegenda = { raiz: $('legenda'), tit: $('legendaTit'), lista: $('legendaLista') };
const elModo = { guiada: $('modoGuiada'), livre: $('modoLivre') };

function aplicarModo(m) {
  const guiada = m === 'guiada';
  app.dataset.modo = guiada ? 'guiada' : 'livre';
  elModo.guiada.setAttribute('aria-pressed', String(guiada));
  elModo.livre.setAttribute('aria-pressed', String(!guiada));
  if (guiada && ouvido.gravando) ouvido.cancelar();
  atualizarChips();
}
function trocarModo(m) { gravar('modo_conversa', m); reaplicarModo(); }
// O modo evento "guiada" e a falta de internet forçam a demonstração guiada, sem mexer na preferência da pessoa.
const eventoModo = () => ler('evento_modo', 'livre');
const guiadaForcada = () => eventoModo() === 'guiada' || redeCaiu;
function reaplicarModo() {
  aplicarModo(guiadaForcada() || ler('modo_conversa', 'livre') === 'guiada' ? 'guiada' : 'livre');
  elModo.livre.disabled = guiadaForcada();
}

function fecharMenu({ foco = false } = {}) {
  if (elMais.menu.hidden) return;
  elMais.menu.hidden = true;
  elMais.btn.setAttribute('aria-expanded', 'false');
  if (foco) elMais.btn.focus();
}
function abrirMenu() {
  elMais.menu.hidden = false;
  elMais.btn.setAttribute('aria-expanded', 'true');
  elMais.menu.querySelector('button').focus();
}
function desenharLegenda() {
  elLegenda.tit.textContent = T.barra.legendaTitulo;
  elLegenda.lista.replaceChildren(...Object.entries(T.barra.legenda).map(([estado, texto]) => {
    const li = document.createElement('li'); li.dataset.estado = estado; li.textContent = texto; return li;
  }));
}
function iniciarBarra() {
  elMais.btn.setAttribute('aria-label', T.barra.maisRotulo);
  $('modo').setAttribute('aria-label', T.barra.modoRotulo);
  elModo.guiada.textContent = T.barra.guiada; elModo.guiada.title = T.barra.guiadaDica;
  elModo.livre.textContent = T.barra.livre; elModo.livre.title = T.barra.livreDica;
  const itens = [
    [T.barra.menu.verDePerto, () => visualizador.entrar()],
    [T.barra.menu.centralizar, () => cena.resetarCamera(reduzirMovimento.matches ? 0 : 500)],
    [T.barra.menu.legenda, () => { elLegenda.raiz.hidden = !elLegenda.raiz.hidden; }],
    [T.barra.menu.outro, () => escolherOutroPersonagem()],
    [T.barra.menu.terminar, () => encerrarSessao('fluxo')],
  ];
  elMais.menu.replaceChildren(...itens.map(([rotulo, acao]) => {
    const li = document.createElement('li'); li.setAttribute('role', 'none');
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = rotulo;
    b.addEventListener('click', () => { fecharMenu(); acao(); });
    li.append(b); return li;
  }));
  desenharLegenda();
  elMais.btn.addEventListener('click', () => (elMais.menu.hidden ? abrirMenu() : fecharMenu({ foco: true })));
  elMais.menu.addEventListener('keydown', (e) => {
    const bs = [...elMais.menu.querySelectorAll('button')];
    const i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); fecharMenu({ foco: true }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
    else if (e.key === 'Tab') fecharMenu();
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.mais-caixa')) fecharMenu(); });
  elModo.guiada.addEventListener('click', () => trocarModo('guiada'));
  elModo.livre.addEventListener('click', () => trocarModo('livre'));
  reaplicarModo();
}

iniciarBarra();

/* ---------- Controles ---------- */
micBtn.addEventListener('click', () => {
  voz.preparar();
  if (maosLivresAtivo) { maosLivresPausado = true; atualizarMaosLivres(); return; } // apertou o botão: volta ao apertar para falar
  if (ouvido.gravando) { ouvido.alternar(); return; }
  if (abortCtl) abortCtl.abort();
  silenciar();
  ouvido.alternar();
});
stopBtn.addEventListener('click', () => { if (abortCtl) abortCtl.abort(); silenciar(); estadoOcioso(); });
$('chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  voz.preparar();
  if (b.dataset.guiada !== undefined) responderGuiada(guiadasDoPersonagem[Number(b.dataset.guiada)]);
  else perguntarAoPersonagem(b.dataset.q);
});
form.addEventListener('submit', (e) => { e.preventDefault(); voz.preparar(); const v = input.value; input.value = ''; perguntarAoPersonagem(v); });

keyInput.value = apiKey;
motorSel.value = config.motor;
urlInput.value = config.urlKokoro;
modeloInput.value = config.modelo;

// Aplica o que está no diálogo sem fechar (Verificar e Testar voz usam os valores digitados).
async function aplicarConfigVoz() {
  const urlNova = urlInput.value.trim() || URL_PADRAO;
  const mudouUrl = urlNova !== config.urlKokoro;
  config.motor = motorSel.value;
  config.urlKokoro = urlNova;
  gravar('motor', config.motor);
  gravar('url_kokoro', config.urlKokoro);
  voz.reiniciarGemini();
  if (mudouUrl || voz.statusServidor.ok !== true) await voz.verificarServidor();
  else voz.resolverMotor(personagem && personagem.voz);
  if (config.motor === 'kokoro-browser') {
    try {
      await voz.navegador.carregar();
      mostrarStatusVoz({ motor: voz.navegador, aviso: null, servidor: await voz.navegador.verificar() });
    } catch (e) {
      console.error('[kokoro-browser] não carregou:', e);
      elStatusVoz.textContent = T.voz.navegadorFalhou;
    }
  }
}

/* ---------- Painel Gemini TTS ---------- */
const gt = { modelo: $('gtModelo'), voz: $('gtVoz'), estilo: $('gtEstilo'), teto: $('gtTeto'), uso: $('gtUso') };
gt.modelo.value = config.gemini.modelo;
gt.voz.value = config.gemini.voz;
gt.estilo.value = config.gemini.estilo;
gt.teto.value = String(tetoGemini());

function medianaDe(v) { if (!v.length) return null; const o = [...v].sort((a, b) => a - b); return o[o.length >> 1]; }
function desenharUsoGemini() {
  gt.uso.textContent = T.vozGemini.uso(usoGemini.chamadas, usoGemini.chars.toLocaleString('pt-BR'), tetoGemini() ? tetoGemini().toLocaleString('pt-BR') : '', (usoGemini.usd * custo.resumo().cambio).toFixed(4));
}
desenharUsoGemini();
for (const [campo, chave, normalizar] of [[gt.modelo, 'gt_modelo', (v) => v], [gt.voz, 'gt_voz', (v) => v.trim() || 'Kore'], [gt.estilo, 'gt_estilo', (v) => v.trim()], [gt.teto, 'gt_teto', (v) => String(Math.max(0, Math.round(Number(v) || 0)))]]) {
  campo.addEventListener('change', () => {
    gravar(chave, normalizar(campo.value));
    if (campo === gt.teto) campo.value = ler(chave, '0');
    voz.reiniciarGemini();
    desenharUsoGemini();
    if (config.motor === 'gemini') aplicarConfigVoz();
  });
}

/* ---------- Visualizador (prompt 06) ---------- */
// Estende a galeria e a tela do personagem; não reescreve nenhuma das duas.
const elViz = {
  barra: $('vizBarra'), nome: $('vizNome'), aviso: $('vizAviso'), entrar: $('vizEntrar'),
  reset: $('vizReset'), seguir: $('vizSeguir'), telaCheia: $('vizTelaCheia'), anterior: $('vizAnterior'),
  tocar: $('vizTocar'), proximo: $('vizProximo'), modo: $('vizModo'), vel: $('vizVel'), sair: $('vizSair'),
};
const TV = T.visualizador;
elViz.barra.setAttribute('aria-label', TV.barra);
for (const [id, rotulo] of [['entrar', TV.entrar], ['reset', TV.resetar], ['anterior', TV.anterior], ['proximo', TV.proximo], ['sair', TV.sair]]) {
  elViz[id].setAttribute('aria-label', rotulo); elViz[id].title = rotulo;
}
elViz.vel.setAttribute('aria-label', TV.velocidade);
$('galeriaVisualizador').textContent = TV.galeria;

function desenharVisualizador(e) {
  // Olhar de perto também é estar usando: sem isto a sessão acabava por inatividade com a pessoa vendo o personagem.
  if (sessaoAtiva) tocarInatividade();
  if (typeof atualizarTitulo === 'function') atualizarTitulo();
  elViz.seguir.setAttribute('aria-pressed', String(e.seguir));
  elViz.seguir.setAttribute('aria-label', TV.seguir); elViz.seguir.title = `${TV.seguir} (T)`;
  const cheia = e.telaCheia || e.telaCheiaCss;
  elViz.telaCheia.setAttribute('aria-pressed', String(cheia));
  elViz.telaCheia.setAttribute('aria-label', cheia ? TV.sairTelaCheia : TV.telaCheia); elViz.telaCheia.title = `${cheia ? TV.sairTelaCheia : TV.telaCheia} (F)`;
  elViz.tocar.setAttribute('aria-pressed', String(e.tocando));
  elViz.tocar.setAttribute('aria-label', e.tocando ? TV.pausar : TV.tocar); elViz.tocar.title = `${e.tocando ? TV.pausar : TV.tocar} (Espaço)`;
  elViz.modo.dataset.modo = e.modo;
  elViz.modo.setAttribute('aria-label', TV.modoRotulo(TV.modo[e.modo])); elViz.modo.title = TV.modoRotulo(TV.modo[e.modo]);
  elViz.vel.value = String(e.velocidade);
  elViz.reset.title = `${TV.resetar} (R)`;
  if (e.ativo && !e.total) elViz.nome.textContent = TV.semClipes;
}

const visualizador = criarVisualizador({
  cena, raiz: app, palco: stage, el: elViz, T,
  avatar: () => avatar,
  clipesAtivos: () => (catalogo ? aplicarEscolhas(catalogo).filter((c) => c.status === 'ativo' && (!modoInfantil.checked || c.infantilOk)) : []),
  carregarClipe: (c) => (avatar ? clipeDoArquivo(c.arquivo, avatar.vrm) : Promise.resolve(null)),
  reduzirMovimento,
  aoMudar: desenharVisualizador,
  aoEntrar: () => { silenciar(); },
});
stage.addEventListener('pointerdown', () => { if (visualizador.ativo && sessaoAtiva) tocarInatividade(); });
elViz.entrar.addEventListener('click', () => visualizador.entrar());
elViz.reset.addEventListener('click', () => visualizador.resetar());
elViz.seguir.addEventListener('click', () => visualizador.definirSeguir(!visualizador.estado.seguir));
elViz.telaCheia.addEventListener('click', () => visualizador.alternarTelaCheia());
elViz.anterior.addEventListener('click', () => visualizador.anterior());
elViz.proximo.addEventListener('click', () => visualizador.proximo());
elViz.tocar.addEventListener('click', () => visualizador.alternar());
elViz.modo.addEventListener('click', () => visualizador.proximoModo());
elViz.vel.addEventListener('change', () => visualizador.definirVelocidade(elViz.vel.value));
elViz.sair.addEventListener('click', () => visualizador.sair());
// O diálogo avisa que fechou DEPOIS (evento close, que também para a prévia da galeria). Entrar só então,
// senão o close derrubava a prévia que o visualizador acabou de iniciar.
$('galeriaVisualizador').addEventListener('click', () => {
  dlg.addEventListener('close', () => visualizador.entrar({ tocarAgora: true }), { once: true });
  dlg.close();
});
desenharVisualizador(visualizador.estado);

/* ---------- Painel de diagnóstico (só o operador vê) ---------- */
const elDiag = $('diag'), elDiagErros = $('diagErros'), elCambio = $('diagCambio');
let timerDiag = null;

const fmtSeg = (s) => (s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`);

// Estado de cada serviço, com o motivo quando está ruim.
function estadoDosServicos() {
  const sv = voz.statusServidor || {};
  const sv2 = T.diagnostico.servicos;
  const lic = personagem ? licencas.get(personagem.id) : null;
  return {
    Gemini: apiKey ? sv2.gemini(config.modelo) : sv2.semChave,
    Voz: (ultimoMotorVoz ? ultimoMotorVoz.nome : sv2.escolhendo) +
      (sv.ok === true ? sv2.servidorOk : sv.ok === false ? sv2.servidorRuim(sv.detalhe) : ''),
    Ouvido: ouvido.gravando ? sv2.ouvindo : sv2.ouvidoPronto,
    Câmera: camera && camera.ligada ? sv2.camLigada : sv2.camDesligada,
    Avatar: avatar ? sv2.avatar(personagem.nome, lic && (T.licenca.decisao[lic.decisao] || lic.decisao)) : sv2.semAvatar,
  };
}

function textoProjecao(g) {
  const media = mediaPorResposta(g);
  const linha = projetar({ respostas: 5000, media, cambio: g.cambio }).find((l) => l.modelo === chaveDoModelo(config.modelo));
  if (!linha) return T.diagnostico.projecaoSemPreco(config.modelo);
  const base = media.medido ? T.diagnostico.projecaoMedida(media.amostras) : T.diagnostico.projecaoPremissa;
  return T.diagnostico.projecaoValor(linha.reaisTotal.toFixed(2), config.modelo, base);
}

const RUIM = /sem chave|fora do ar|falhou|sem avatar|bloqueado/i;

function desenharDiagnostico() {
  if (!dlg.open) return;
  const r = diagnostico.retrato(estadoDosServicos());
  const g = custo.resumo();
  const D = T.diagnostico;
  const n = (v) => v.toLocaleString('pt-BR');
  const linhas = [
    [D.versao, `${VERSAO} (${VERSAO_MARCO}, ${VERSAO_DATA})`, false],
    [D.emPe, fmtSeg(r.emPe), false],
    [D.fps, r.fps === null ? D.medindo : String(r.fps), r.fps !== null && r.fps < 25],
    [D.imagem, r.contextoPerdido ? D.imagemPerdida : D.imagemOk, r.contextoPerdido],
    [D.memoria, r.memoria ? D.memoriaValor(r.memoria.usadaMb, r.memoria.limiteMb) : D.semMemoria, false],
    [D.gpu, r.gpu ? D.gpuValor(r.gpu.geometrias, r.gpu.texturas) : D.semDados, false],
    [D.respostaGemini, r.latencia.perguntaMs === null ? D.semMedida : D.ms(r.latencia.perguntaMs, r.latencia.amostras), false],
    [D.ateFala, r.latencia.falaMs === null ? D.semMedida : D.ms(r.latencia.falaMs), false],
    [D.transcricao, r.latencia.transcricaoMs === null ? D.semMedida : D.ms(r.latencia.transcricaoMs), false],
    [D.qualidade, D.qualidadeValor(cena.qualidade.pixelRatio, cena.qualidade.automatica), cena.qualidade.degrau > 0],
    [D.vozAgora, personagem ? D.vozAgoraValor(personagem.nome, ultimoMotorVoz && ultimoMotorVoz.id === 'gemini' ? ((efetivo(personagem).voz.gemini && efetivo(personagem).voz.gemini.voz) || config.gemini.voz) : efetivo(personagem).voz.id, (ultimoMotorVoz && ultimoMotorVoz.id) || 'escolhendo') : D.semDados, false],
    [D.vozGemini, usoGemini.chamadas ? D.vozGeminiValor(usoGemini.chamadas, usoGemini.chars.toLocaleString('pt-BR'), (usoGemini.usd * g.cambio).toFixed(4), medianaDe(usoGemini.latencias)) : D.vozGeminiNenhuma, false],
    [D.respostasHoje, D.respostasValor(g.respostas, g.sessao.respostas), false],
    [D.tokensHoje, D.tokensValor(n(g.entrada), n(g.saida + g.pensamento)), false],
    [D.orcamento, tetoReais() ? T.orcamento.diagnosticoValor(g.acumuladoReais.toFixed(2), tetoReais().toFixed(0), Math.round(situacaoOrcamento().pct * 100)) : T.orcamento.diagnosticoSemTeto(g.acumuladoReais.toFixed(2)), situacaoOrcamento().nivel === 'aviso' || situacaoOrcamento().nivel === 'estourou'],
    [D.gastoHoje, g.semPreco.length ? D.gastoSemPreco(g.reais.toFixed(2), g.semPreco.join(', ')) : D.gastoValor(g.reais.toFixed(2)), g.semPreco.length > 0],
    [D.projecao, textoProjecao(g), false],
    [D.recargas, String(contarRecargas()), contarRecargas() > 0],
    [D.erros, r.erros ? D.errosValor(r.erros, r.ultimoErro.t) : D.semErros, r.erros > 0],
  ];
  for (const [nome, valor] of Object.entries(r.servicos)) linhas.push([nome, valor, RUIM.test(valor)]);

  elDiag.replaceChildren(...linhas.flatMap(([nome, valor, alerta]) => {
    const dt = document.createElement('dt'); dt.textContent = nome;
    const dd = document.createElement('dd'); dd.textContent = valor;
    if (alerta) dd.dataset.alerta = 'sim';
    return [dt, dd];
  }));
  $('diagFonte').textContent = D.fonte(g.fonte);
  elDiagErros.replaceChildren(...diagnostico.erros.slice(-5).reverse().map((e) => {
    const li = document.createElement('li');
    li.textContent = `${e.t} ${e.origem}: ${e.mensagem}`;
    return li;
  }));
}

// Situação do gasto contra o teto. Aos 80% a engrenagem ganha um ponto; no teto o app passa ao modo econômico.
function situacaoOrcamento() { return situacaoDoTeto(custo.resumo().acumuladoReais, tetoReais()); }
function modoEconomicoAtivo() { return economicoManual() || situacaoOrcamento().nivel === 'estourou'; }
let avisouOrcamento = null;
function pintarAlerta() { $('gear').dataset.alerta = alertaOrcamento || alertaEvento ? 'sim' : 'nao'; }
// Cada degrau da escada de falhas avisa o operador e a conversa continua. O ponto da engrenagem some quando o painel abre.
function avisarOperador(mensagem) {
  const t = new Date().toISOString().slice(11, 19);
  if (avisosEvento[0] && avisosEvento[0].mensagem === mensagem) return; // não repete o mesmo aviso em fila
  avisosEvento.unshift({ t, mensagem });
  if (avisosEvento.length > 20) avisosEvento.pop();
  alertaEvento = true; pintarAlerta();
  console.warn('[evento] ' + mensagem);
  if (typeof desenharAvisosEvento === 'function') desenharAvisosEvento();
}
function atualizarAlertaOrcamento() {
  const s = situacaoOrcamento();
  alertaOrcamento = s.nivel === 'aviso' || s.nivel === 'estourou';
  pintarAlerta();
  if (s.nivel !== avisouOrcamento && (s.nivel === 'aviso' || s.nivel === 'estourou')) {
    console.warn('[orcamento] ' + (s.nivel === 'estourou' ? T.orcamento.estourou : T.orcamento.aviso(Math.round(s.pct * 100))));
  }
  avisouOrcamento = s.nivel;
}
elCambio.value = String(custo.resumo().cambio);
elCambio.addEventListener('change', () => {
  custo.definirCambio(elCambio.value);
  gravar('cambio', String(custo.resumo().cambio));
});
$('diagZerar').addEventListener('click', () => { custo.zerarSessao(); desenharDiagnostico(); });
$('diagContexto').addEventListener('click', () => {
  if (!cena.perderContextoDeProposito()) {
    $('diagFonte').textContent = T.diagnostico.semPerdaDeContexto;
    return;
  }
  dlg.close();
});

const telaLargaParaPainel = matchMedia('(min-width: 1000px)');
function abrirConfiguracoes() {
  // Em tela larga o painel encaixa à direita e não bloqueia a cena (ela é a prévia); em tela estreita é modal.
  const encaixar = telaLargaParaPainel.matches;
  dlg.dataset.encaixado = encaixar ? 'sim' : 'nao';
  if (encaixar) dlg.show(); else dlg.showModal();
}
// Painel não modal não fecha com Esc sozinho.
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg.open && dlg.dataset.encaixado === 'sim') dlg.close(); });
$('gear').addEventListener('click', () => {
  alertaEvento = false; pintarAlerta();
  abrirConfiguracoes();
  desenharDiagnostico();
  clearInterval(timerDiag);
  timerDiag = setInterval(desenharDiagnostico, 1000);
});
dlg.addEventListener('close', () => { clearInterval(timerDiag); timerDiag = null; });
$('keyform').addEventListener('submit', (e) => e.preventDefault());
voiceSel.addEventListener('change', () => voz.sistema.escolherVoz(voiceSel.value));
bocaSel.value = config.lipsync;
bocaSel.addEventListener('change', () => {
  config.lipsync = bocaSel.value;
  gravar('lipsync', config.lipsync);
  boca.definirModo(config.lipsync);
});
motorSel.addEventListener('change', aplicarConfigVoz);
$('verificarVoz').addEventListener('click', aplicarConfigVoz);
$('closeSettings').addEventListener('click', async () => {
  apiKey = keyInput.value.trim();
  gravar('gemini_key', apiKey);
  config.modelo = modeloInput.value.trim() || MODELO_PADRAO;
  gravar('modelo', config.modelo);
  dlg.close();
  await aplicarConfigVoz();
  if (!ocupado && !ouvido.gravando) definirEstado('idle', apiKey ? T.estado.pronto : T.estado.faltaChave);
});
$('testVoice').addEventListener('click', async () => {
  voz.preparar(); silenciar();
  await aplicarConfigVoz();
  const p = personagem || disponiveis[0] || PERSONAGENS[0];
  const vozTeste = config.motor === 'kokoro-browser' ? { motor: 'kokoro-browser', id: 'af_heart', speed: 1 } : efetivo(p).voz;
  const frase = config.motor === 'kokoro-browser' ? T.voz.testeIngles(p.nome) : T.voz.teste(p.nome);
  voz.falarTexto(frase, vozTeste);
});

/* ---------- Câmera (M6) ---------- */
const camBtn = $('camBtn'), camAviso = $('camAviso'), camEstado = $('camEstado');
const camCfg = {
  cumprimentar: ler('cam_cumprimentar', 'sim') === 'sim',
  sorriso: ler('cam_sorriso', 'sim') === 'sim',
  espelho: ler('cam_espelho', 'nao') === 'sim',
};
const INTERVALO_OI_S = 45;
let presenca = criarPresenca(), detSorriso = criarDetectorSorriso(), ultimoOi = -Infinity, ultimaLeitura = null;
const filtros = { x: new FiltroOneEuro({ beta: 0.3 }), y: new FiltroOneEuro({ beta: 0.3 }),
  yaw: new FiltroOneEuro({ beta: 0.5 }), pitch: new FiltroOneEuro({ beta: 0.5 }), roll: new FiltroOneEuro({ beta: 0.5 }) };

function cumprimentarQuemChegou() {
  if (!personagem || ocupado || app.dataset.state !== 'idle') return;
  if (etapa === 'atracao') definirEtapa('selecao'); // o rosto chama a seleção; quem escolhe é a pessoa
}

const camera = criarCamera({
  aoMudar: ({ estado, motivo }) => {
    const ligada = estado === 'ligada';
    camBtn.setAttribute('aria-pressed', String(ligada));
    camBtn.setAttribute('aria-label', ligada ? T.camera.desligar : T.camera.ligar);
    camAviso.hidden = !ligada;
    camEstado.textContent = { ligando: T.camera.ligando, ligada: T.camera.ligada(camera.delegado || ''), desligada: T.camera.desligada, erro: T.camera.erro(motivo) }[estado];
    if (!ligada) {
      presenca = criarPresenca(); detSorriso = criarDetectorSorriso();
      if (avatar) { avatar.olharPara(null); avatar.espelhar(null); }
    }
  },
  aoLeitura: (r, t) => {
    ultimaLeitura = r;
    const ev = presenca.atualizar(r.presente, t);
    if (ev === 'apareceu' && camCfg.cumprimentar && t - ultimoOi > INTERVALO_OI_S) { ultimoOi = t; cumprimentarQuemChegou(); }
    if (ev === 'sumiu' && avatar) { avatar.olharPara(null); avatar.espelhar(null); }
    if (!avatar || !r.presente || !presenca.presente) return;
    // Olhar: a webcam não espelha. Quem anda para a própria direita aparece à ESQUERDA da imagem
    // (x menor) e fica à DIREITA da tela (x do mundo maior); daí o (0.5 - x).
    const x = filtros.x.filtrar(r.x, t), y = filtros.y.filtrar(r.y, t), h = avatar.posicaoCabeca;
    avatar.olharPara({ x: h.x + (0.5 - x) * 1.2, y: h.y + (0.5 - y) * 0.8, z: h.z + 1.5 });
    if (camCfg.sorriso && detSorriso.atualizar(r.sorriso, t)) avatar.reagir(2.2);
    if (camCfg.espelho) {
      const a = r.angulos && { yaw: filtros.yaw.filtrar(r.angulos.yaw, t), pitch: filtros.pitch.filtrar(r.angulos.pitch, t), roll: filtros.roll.filtrar(r.angulos.roll, t) };
      avatar.espelhar({ piscadaE: r.piscadaE, piscadaD: r.piscadaD, boca: r.boca, sorriso: r.sorriso, angulos: a });
    } else {
      avatar.espelhar(null);
    }
  },
});

// Ligar só com clique explícito; nunca liga sozinha (nem lembra entre visitas).
camBtn.addEventListener('click', () => (camera.ligada ? camera.desligar() : camera.ligar()));
for (const [id, chave] of [['camCumprimentar', 'cumprimentar'], ['camSorriso', 'sorriso'], ['camEspelho', 'espelho']]) {
  const el = $(id);
  el.checked = camCfg[chave];
  el.addEventListener('change', () => {
    camCfg[chave] = el.checked;
    gravar('cam_' + chave, el.checked ? 'sim' : 'nao');
    if (chave === 'espelho' && !el.checked && avatar) avatar.espelhar(null);
  });
}

/* ---------- Configurações por personagem ---------- */
const aj = {
  sel: $('ajPersonagem'), persona: $('ajPersona'), limite: $('ajLimite'), tempPadrao: $('ajTempPadrao'),
  temp: $('ajTemp'), tempValor: $('ajTempValor'), voz: $('ajVoz'), vozGemini: $('ajVozGemini'), vel: $('ajVel'), velValor: $('ajVelValor'),
};
aj.sel.replaceChildren(...PERSONAGENS.map((p) => {
  const o = document.createElement('option'); o.value = p.id; o.textContent = p.nome; return o;
}));

function preencherAjustes() {
  const base = buscarPersonagem(aj.sel.value);
  const ef = efetivo(base);
  aj.persona.value = ef.persona;
  aj.limite.value = ef.limitePalavras ?? '';
  aj.tempPadrao.checked = ef.temperatura === null || ef.temperatura === undefined;
  aj.temp.value = aj.tempPadrao.checked ? 1 : ef.temperatura;
  aj.temp.disabled = aj.tempPadrao.checked;
  aj.tempValor.textContent = aj.tempPadrao.checked ? 'padrão' : Number(aj.temp.value).toFixed(1);
  aj.voz.value = ef.voz.id;
  aj.vozGemini.value = (ef.voz.gemini && ef.voz.gemini.voz) || '';
  aj.vel.value = ef.voz.speed;
  aj.velValor.textContent = Number(ef.voz.speed).toFixed(2);
  const vozes = (voz.statusServidor.vozes || []).filter((v) => /^p[fm]_/.test(v)).concat((voz.statusServidor.vozes || []).filter((v) => !/^p[fm]_/.test(v)));
  $('vozesKokoro').replaceChildren(...vozes.map((v) => { const o = document.createElement('option'); o.value = v; return o; }));
}

// Grava só o que difere do padrão de characters.js.
function salvarAjustes() {
  const base = buscarPersonagem(aj.sel.value);
  const a = {};
  if (aj.persona.value.trim() && aj.persona.value !== base.persona) a.persona = aj.persona.value;
  const lim = parseInt(aj.limite.value, 10);
  if (Number.isFinite(lim) && lim !== base.limitePalavras) a.limitePalavras = Math.min(400, Math.max(20, lim));
  const temp = aj.tempPadrao.checked ? null : Number(aj.temp.value);
  if (temp !== base.temperatura) a.temperatura = temp;
  if (aj.voz.value.trim() && aj.voz.value.trim() !== base.voz.id) a.vozId = aj.voz.value.trim();
  const gv = aj.vozGemini.value.trim();
  if (gv && gv !== ((base.voz.gemini && base.voz.gemini.voz) || '')) a.vozGemini = gv;
  const vel = Number(aj.vel.value);
  if (Math.abs(vel - base.voz.speed) > 1e-9) a.vozSpeed = vel;
  if (Object.keys(a).length) ajustes[base.id] = a; else delete ajustes[base.id];
  gravarJSON('ajustes_personagens', ajustes);
  aj.temp.disabled = aj.tempPadrao.checked;
  aj.tempValor.textContent = aj.tempPadrao.checked ? 'padrão' : Number(aj.temp.value).toFixed(1);
  aj.velValor.textContent = vel.toFixed(2);
}

aj.sel.addEventListener('change', preencherAjustes);
for (const el of [aj.persona, aj.limite, aj.temp, aj.voz, aj.vozGemini, aj.vel]) el.addEventListener('input', salvarAjustes);
aj.tempPadrao.addEventListener('change', salvarAjustes);
$('ajRestaurar').addEventListener('click', () => {
  delete ajustes[aj.sel.value];
  gravarJSON('ajustes_personagens', ajustes);
  preencherAjustes();
});
dlg.addEventListener('toggle', () => {
  if (!dlg.open) return;
  if (personagem) aj.sel.value = personagem.id;
  preencherAjustes();
});

/* ---------- Base de conhecimento (R4) ---------- */
const elRag = {
  dica: $('ragDica'), estado: $('ragEstado'), preparar: $('ragPreparar'), apagar: $('ragApagar'), limiar: $('ragLimiar'), limiarV: $('ragLimiarV'),
  limiarDica: $('ragLimiarDica'), teste: $('ragTeste'), testar: $('ragTestar'), resultado: $('ragResultado'), trechos: $('ragTrechos'),
};
const RG = T.rag;
$('ragLegenda').textContent = RG.legenda; elRag.dica.textContent = RG.dica; $('ragLimiarR').textContent = RG.limiar;
elRag.limiarDica.textContent = RG.limiarDica; $('ragTesteR').textContent = RG.testar; elRag.testar.textContent = RG.testarBotao;
elRag.preparar.textContent = RG.preparar; elRag.apagar.textContent = RG.apagar;
elRag.limiar.value = ler('rag_limiar', '0.8'); elRag.limiarV.textContent = Number(elRag.limiar.value).toFixed(2); rag.definirLimiar(elRag.limiar.value);

async function desenharRag() {
  const pid = aj.sel.value;
  const e = await rag.verificar(pid);
  elRag.estado.textContent = e.documentos ? RG.estado(e.documentos, e.indexados) : RG.semDocumentos;
  elRag.preparar.disabled = !e.documentos || !e.pendentes.length;
  elRag.apagar.disabled = !e.indexados;
  elRag.testar.disabled = !rag.pronto(pid);
}
elRag.limiar.addEventListener('input', () => { gravar('rag_limiar', elRag.limiar.value); elRag.limiarV.textContent = Number(elRag.limiar.value).toFixed(2); rag.definirLimiar(elRag.limiar.value); });
elRag.preparar.addEventListener('click', async () => {
  const pid = aj.sel.value;
  elRag.preparar.disabled = true;
  try {
    const r = await rag.preparar(pid, (n, total) => { elRag.estado.textContent = RG.preparando(n, total); });
    elRag.resultado.textContent = r.recusados && r.recusados.length ? r.recusados.map((x) => RG.recusado(x.arquivo, x.erros)).join(' ') : RG.pronto;
  } catch (e) { console.warn('[rag] preparo falhou:', e); elRag.resultado.textContent = RG.falhou(e.message); }
  desenharRag();
});
elRag.apagar.addEventListener('click', async () => { await rag.apagar(aj.sel.value); elRag.resultado.textContent = ''; desenharRag(); });
elRag.testar.addEventListener('click', async () => {
  const pid = aj.sel.value, q = elRag.teste.value.trim();
  if (!q) return;
  if (!rag.pronto(pid)) { elRag.resultado.textContent = RG.testarSemBase; return; }
  try {
    const r = await rag.consultar(pid, q);
    elRag.resultado.textContent = RG.testarResultado(r.melhorCosseno.toFixed(3), r.confiante);
    elRag.trechos.replaceChildren(...r.resultados.map((t) => { const li = document.createElement('li'); li.textContent = `${t.titulo}, ${t.secao}: cosseno ${t.cosseno.toFixed(3)}, palavras-chave ${t.palavraChave.toFixed(2)}`; return li; }));
  } catch (e) { console.warn('[rag] teste falhou:', e); elRag.resultado.textContent = RG.falhou(e.message); }
});
aj.sel.addEventListener('change', desenharRag);
dlg.addEventListener('toggle', () => { if (dlg.open) desenharRag(); });

/* ---------- Console do operador (I5): abas e cena ---------- */
const ABA_DE = {
  Gemini: 'orcamento', Diagnóstico: 'orcamento', Voz: 'voz', 'Gemini TTS': 'voz', Personagem: 'personagem', 'Cena do personagem': 'cena', Orçamento: 'orcamento', 'Modo evento': 'evento', 'Base de conhecimento': 'personagem',
  Câmera: 'sessao', Boca: 'sessao', Sessão: 'sessao', 'Modo totem': 'sessao', Animações: 'animacoes', 'Enviar movimento': 'animacoes',
  'Armazenamento e uso offline': 'armazenamento', Licenças: 'armazenamento',
};
const elAbas = $('abas');
const fieldsets = [...dlg.querySelectorAll('fieldset')];
const abaDe = (fs) => { const l = fs.querySelector('legend'); return ABA_DE[(l && l.textContent.trim()) || ''] || 'sessao'; };
function mostrarAba(nome) {
  gravar('aba_operador', nome);
  for (const fs of fieldsets) fs.hidden = abaDe(fs) !== nome;
  for (const b of elAbas.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.aba === nome));
}
elAbas.setAttribute('aria-label', T.console.rotuloAbas);
for (const [id, rotulo] of Object.entries(T.console.abas)) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.aba = id; b.textContent = rotulo; b.setAttribute('role', 'tab');
  b.addEventListener('click', () => mostrarAba(id));
  elAbas.append(b);
}

// Cena: luz, fundo e enquadramento do personagem escolhido em "Personagem". Só o que difere do padrão fica guardado.
const C = T.console;
const cena_ = {
  luz: { ambiente: $('cenaLuzAmbiente'), principal: $('cenaLuzPrincipal'), preenchimento: $('cenaLuzPreenchimento'), recorte: $('cenaLuzRecorte') },
  f1: $('cenaFundo1'), f2: $('cenaFundo2'), dist: $('cenaDistancia'), alt: $('cenaAltura'), aviso: $('cenaFundoAviso'),
};
$('cenaLegenda').textContent = C.cenaLegenda; $('cenaDica').textContent = C.cenaDica;
$('cenaLuzTitulo').textContent = C.luz; $('cenaFundoTitulo').textContent = C.fundo; $('cenaEnqTitulo').textContent = C.enquadramento;
$('cenaLuzAmbienteR').textContent = C.luzAmbiente; $('cenaLuzPrincipalR').textContent = C.luzPrincipal;
$('cenaLuzPreenchimentoR').textContent = C.luzPreenchimento; $('cenaLuzRecorteR').textContent = C.luzRecorte;
$('cenaFundo1R').textContent = C.fundoTopo; $('cenaFundo2R').textContent = C.fundoBase;
$('cenaDistanciaR').textContent = C.distancia; $('cenaAlturaR').textContent = C.altura;
$('cenaRestaurar').textContent = C.restaurarCena;

const LUZ_BASE = { ambiente: 1.6, principal: 1.8, preenchimento: 0, recorte: 0.8 };
const luzBaseDe = (p, k) => ((p.luz || {})[k] || {}).intensidade ?? LUZ_BASE[k];
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const razaoContraste = (a, b) => { const x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

function preencherCena() {
  const base = buscarPersonagem(aj.sel.value), ef = efetivo(base);
  for (const [k, el] of Object.entries(cena_.luz)) { el.value = (ef.luz && ef.luz[k] && ef.luz[k].intensidade) ?? luzBaseDe(base, k); $(`cenaLuz${k[0].toUpperCase()}${k.slice(1)}V`).textContent = Number(el.value).toFixed(2); }
  cena_.f1.value = ef.paleta.fundo1; cena_.f2.value = ef.paleta.fundo2; cena_.aviso.textContent = '';
  cena_.dist.value = ef.enquadramento.distancia; cena_.alt.value = ef.enquadramento.altura;
  $('cenaDistanciaV').textContent = Number(cena_.dist.value).toFixed(2); $('cenaAlturaV').textContent = Number(cena_.alt.value).toFixed(2);
}

function salvarCena() {
  const base = buscarPersonagem(aj.sel.value);
  const a = { ...(ajustes[base.id] || {}) };
  const luz = {};
  for (const [k, el] of Object.entries(cena_.luz)) if (Math.abs(Number(el.value) - luzBaseDe(base, k)) > 1e-9) luz[k] = { intensidade: Number(el.value) };
  if (Object.keys(luz).length) a.luz = luz; else delete a.luz;
  const fundo = {};
  const tinta = base.paleta.tinta || '#ffffff';
  const r = Math.min(razaoContraste(tinta, cena_.f1.value), razaoContraste(tinta, cena_.f2.value));
  if (r < 4.5) {
    cena_.aviso.textContent = C.fundoAviso(r.toFixed(1).replace('.', ','));
    cena_.f1.value = (a.fundo && a.fundo.fundo1) || base.paleta.fundo1; cena_.f2.value = (a.fundo && a.fundo.fundo2) || base.paleta.fundo2;
  } else {
    cena_.aviso.textContent = '';
    if (cena_.f1.value !== base.paleta.fundo1) fundo.fundo1 = cena_.f1.value;
    if (cena_.f2.value !== base.paleta.fundo2) fundo.fundo2 = cena_.f2.value;
    if (Object.keys(fundo).length) a.fundo = fundo; else delete a.fundo;
  }
  const enq = {};
  if (Math.abs(Number(cena_.dist.value) - base.enquadramento.distancia) > 1e-9) enq.distancia = Number(cena_.dist.value);
  if (Math.abs(Number(cena_.alt.value) - base.enquadramento.altura) > 1e-9) enq.altura = Number(cena_.alt.value);
  if (Object.keys(enq).length) a.enquadramento = enq; else delete a.enquadramento;
  if (Object.keys(a).length) ajustes[base.id] = a; else delete ajustes[base.id];
  gravarJSON('ajustes_personagens', ajustes);
  // Ao vivo, se for o personagem em cena.
  if (personagem && personagem.id === base.id) {
    const ef = efetivo(base);
    aplicarPaleta(ef.paleta); cena.definirLuz(ef.luz);
    if (avatar) { cena.definirFoco(avatar.posicaoCabeca, ef.enquadramento); aplicarEnquadramento(true); }
  }
  preencherCena();
}
for (const el of [...Object.values(cena_.luz), cena_.f1, cena_.f2, cena_.dist, cena_.alt]) el.addEventListener('input', salvarCena);
$('cenaRestaurar').addEventListener('click', () => {
  const a = { ...(ajustes[aj.sel.value] || {}) };
  delete a.luz; delete a.fundo; delete a.enquadramento;
  if (Object.keys(a).length) ajustes[aj.sel.value] = a; else delete ajustes[aj.sel.value];
  gravarJSON('ajustes_personagens', ajustes);
  if (personagem && personagem.id === aj.sel.value) {
    const ef = efetivo(personagem);
    aplicarPaleta(ef.paleta); cena.definirLuz(ef.luz);
    if (avatar) { cena.definirFoco(avatar.posicaoCabeca, ef.enquadramento); aplicarEnquadramento(true); }
  }
  preencherCena();
});
aj.sel.addEventListener('change', preencherCena);
dlg.addEventListener('toggle', () => { if (dlg.open) { preencherCena(); mostrarAba(ler('aba_operador', 'cena')); } });

/* ---------- Modo evento (U6): campos do operador, fila, pacote de áudio e rede ---------- */
const EV = T.evento;
const elEv = {
  dica: $('evDica'), modo: $('evModo'), guiadaEstado: $('evGuiadaEstado'), turnos: $('evTurnos'), minutos: $('evMinutos'),
  filaN: $('evFilaN'), mais: $('evFilaMais'), menos: $('evFilaMenos'), pacote: $('evPacote'), pacoteStatus: $('evPacoteStatus'), avisos: $('evAvisos'), fila: $('fila'),
};
$('evDica').textContent = EV.dica; $('evModoR').textContent = EV.modo; $('evTurnosR').textContent = EV.turnos; $('evMinutosR').textContent = EV.minutos;
$('evFilaR').textContent = EV.fila; $('evAvisosR').textContent = EV.avisos; $('evPacoteDica').textContent = EV.pacoteDica;
elEv.mais.textContent = EV.filaMais; elEv.menos.textContent = EV.filaMenos; elEv.pacote.textContent = EV.pacote;
elEv.modo.options[0].textContent = EV.modoLivre; elEv.modo.options[1].textContent = EV.modoGuiada;
elEv.modo.value = eventoModo(); elEv.turnos.value = ler('ev_turnos', '0'); elEv.minutos.value = ler('ev_minutos', '0');
const aplicarPolitica = () => politica.configurar(Number(ler('ev_turnos', '0')), Number(ler('ev_minutos', '0')) * 60);
aplicarPolitica();
elEv.modo.addEventListener('change', () => { gravar('evento_modo', elEv.modo.value); reaplicarModo(); });
elEv.turnos.addEventListener('input', () => { gravar('ev_turnos', String(Math.max(0, Number(elEv.turnos.value) || 0))); aplicarPolitica(); });
elEv.minutos.addEventListener('input', () => { gravar('ev_minutos', String(Math.max(0, Number(elEv.minutos.value) || 0))); aplicarPolitica(); });

// Fila visível: o operador conta; a tela de atração mostra.
const filaN = () => Math.max(0, Number(ler('fila', '0')) || 0);
function desenharFila() {
  const n = filaN();
  elEv.filaN.textContent = String(n);
  elEv.fila.hidden = n === 0; elEv.fila.textContent = n ? EV.filaTexto(n) : '';
}
elEv.mais.addEventListener('click', () => { gravar('fila', String(filaN() + 1)); desenharFila(); });
elEv.menos.addEventListener('click', () => { gravar('fila', String(Math.max(0, filaN() - 1))); desenharFila(); });
desenharFila();

function desenharAvisosEvento() {
  elEv.avisos.replaceChildren(...(avisosEvento.length ? avisosEvento : [{ t: '', mensagem: EV.semAvisos }]).slice(0, 8).map((a) => {
    const li = document.createElement('li'); li.textContent = a.t ? `${a.t} ${a.mensagem}` : a.mensagem; return li;
  }));
}
function desenharEvento() {
  elEv.guiadaEstado.textContent = guiadasDoPersonagem.length ? EV.guiadaTem(guiadasDoPersonagem.length) : EV.guiadaSem;
  desenharAvisosEvento();
}
dlg.addEventListener('toggle', () => { if (dlg.open) desenharEvento(); });

// Pacote de áudio: só voz gratuita. Sintetiza (ou lê do disco) cada resposta guiada aprovada de cada personagem.
elEv.pacote.addEventListener('click', async () => {
  if (config.motor === 'gemini') { elEv.pacoteStatus.textContent = EV.pacotePaga; return; }
  const itens = [];
  for (const p of disponiveis) for (const g of itensAprovados(await rag.guiadasDe(p.id))) itens.push([p, g]);
  if (!itens.length) { elEv.pacoteStatus.textContent = EV.pacoteSem; return; }
  elEv.pacote.disabled = true;
  let feitos = 0;
  for (const [p, g] of itens) {
    const ok = await voz.preSintetizar(g.resposta, efetivo(p).voz);
    if (ok) feitos++;
    elEv.pacoteStatus.textContent = EV.pacoteProgresso(feitos, itens.length);
  }
  elEv.pacoteStatus.textContent = EV.pacotePronto(feitos);
  elEv.pacote.disabled = false;
});

// Rede: cai, volta. Sem internet o app passa sozinho à demonstração guiada e avisa o operador.
window.addEventListener('offline', () => { redeCaiu = true; avisarOperador(EV.aviso.semRede); reaplicarModo(); });
window.addEventListener('online', () => { redeCaiu = false; avisarOperador(EV.aviso.redeVoltou); reaplicarModo(); });
if (redeCaiu) { avisosEvento.unshift({ t: new Date().toISOString().slice(11, 19), mensagem: EV.aviso.semRede }); }

/* ---------- Orçamento (U5): campos do operador ---------- */
const O = T.orcamento;
$('orcDica').textContent = O.dica; $('orcTetoR').textContent = O.teto; $('orcReservaR').textContent = O.reserva;
$('orcReservaDica').textContent = O.reservaDica; $('orcEconomicoR').textContent = O.economico; $('orcProxyR').textContent = O.proxy; $('orcProxyDica').textContent = O.proxyDica;
$('orcTeto').value = String(tetoReais()); $('orcReserva').value = modeloReserva(); $('orcEconomico').checked = economicoManual(); $('orcProxy').value = proxyUrl();
$('orcTeto').addEventListener('input', () => { gravar('teto_reais', String(Math.max(0, Number($('orcTeto').value) || 0))); atualizarAlertaOrcamento(); desenharDiagnostico(); });
$('orcReserva').addEventListener('input', () => gravar('modelo_reserva', $('orcReserva').value.trim()));
$('orcEconomico').addEventListener('change', () => { gravar('modo_economico', $('orcEconomico').checked ? 'sim' : 'nao'); atualizarAlertaOrcamento(); });
$('orcProxy').addEventListener('input', () => gravar('proxy_url', $('orcProxy').value.trim()));
atualizarAlertaOrcamento();

/* ---------- Voz mãos-livres (R5) ---------- */
const elML = { caixa: $('maosLivres'), rotulo: $('maosLivresRotulo'), dica: $('maosLivresDica') };
elML.rotulo.textContent = T.maosLivres.rotulo; elML.dica.textContent = T.maosLivres.dica;
const maosLivresLigado = () => ler('maos_livres', 'nao') === 'sim';
elML.caixa.checked = maosLivresLigado();
// Só liga com sessão em conversa e o microfone aceito. Qualquer outra coisa desliga.
async function atualizarMaosLivres() {
  maosLivresAtivo = ouvido.maosLivres; // o ouvido pode ter parado sozinho (cancelar ao trocar de personagem)
  const querer = maosLivresLigado() && !maosLivresPausado && sessaoAtiva && etapa === 'conversa' && microfone === 'sim';
  if (querer && !maosLivresAtivo) { maosLivresAtivo = await ouvido.iniciarMaosLivres(); if (maosLivresAtivo) estadoOcioso(); }
  else if (!querer && maosLivresAtivo) { await ouvido.pararMaosLivres(); maosLivresAtivo = false; if (!ocupado) estadoOcioso(); }
}
elML.caixa.addEventListener('change', () => {
  gravar('maos_livres', elML.caixa.checked ? 'sim' : 'nao');
  maosLivresPausado = false;
  if (elML.caixa.checked && microfone !== 'sim') elML.dica.textContent = T.maosLivres.precisaMicrofone + ' ' + T.maosLivres.dica;
  atualizarMaosLivres();
});

/* ---------- Modo totem (R6) ---------- */
// Tela cheia no primeiro toque (o navegador só deixa dentro de um gesto), engrenagem escondida e sem menu de contexto.
// O operador volta pelo canto superior direito (pressão de 3 s) ou por Ctrl+Shift+O.
const elTotem = { caixa: $('totemModo'), rotulo: $('totemRotulo'), dica: $('totemDica'), ponto: $('opPonto') };
elTotem.rotulo.textContent = T.totem.rotulo; elTotem.dica.textContent = T.totem.dica; elTotem.ponto.setAttribute('aria-label', T.totem.ponto);
const totemLigado = () => ler('totem', 'nao') === 'sim';
function aplicarTotem() { app.dataset.totem = totemLigado() ? 'sim' : 'nao'; elTotem.caixa.checked = totemLigado(); }
elTotem.caixa.addEventListener('change', () => { gravar('totem', elTotem.caixa.checked ? 'sim' : 'nao'); aplicarTotem(); });
aplicarTotem();
document.addEventListener('pointerdown', () => {
  if (totemLigado() && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch((e) => console.warn('[totem] tela cheia negada:', e));
  }
});
document.addEventListener('contextmenu', (e) => { if (totemLigado() && !dlg.open) e.preventDefault(); });
let timerPonto = null;
const abrirOperador = () => { if (!dlg.open) $('gear').click(); }; // o clique da engrenagem também liga o diagnóstico ao vivo
elTotem.ponto.addEventListener('pointerdown', () => { clearTimeout(timerPonto); timerPonto = setTimeout(abrirOperador, 3000); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) elTotem.ponto.addEventListener(ev, () => clearTimeout(timerPonto));
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); abrirOperador(); } });

/* ---------- Armazenamento e uso offline (R3) ---------- */
let swEsperando = null;
const elSto = {
  dica: $('stoDica'), lista: $('stoLista'), perm: $('stoPermanente'), atuTexto: $('stoAtualizacaoTexto'), atu: $('stoAtualizar'),
  persTitulo: $('stoPersonagensTitulo'), pers: $('stoPersonagens'), apBin: $('stoApagarBin'), apLib: $('stoApagarLib'), apAudio: $('stoApagarAudio'), apTudo: $('stoApagarTudo'), status: $('stoStatus'),
};
const SA = T.armazenamento;
elSto.dica.textContent = SA.dica; elSto.persTitulo.textContent = SA.personagens;
elSto.apBin.textContent = SA.apagarBinarios; elSto.apLib.textContent = SA.apagarBibliotecas; elSto.apAudio.textContent = SA.apagarAudio; elSto.apTudo.textContent = SA.apagarTudo;
elSto.perm.textContent = SA.pedirPermanente; elSto.atu.textContent = SA.atualizar;

// O que um personagem precisa para abrir sem internet: o modelo e os clipes ativos.
const arquivosDe = (p) => [p.arquivoVrm, ...(catalogo ? aplicarEscolhas(catalogo).filter((c) => c.status === 'ativo').map((c) => c.arquivo) : [])];

async function desenharArmazenamento() {
  const [u, t, offline] = await Promise.all([usoEcota(), tamanhosPorCategoria(), prontoOffline(disponiveis.map((p) => p.arquivoVrm))]);
  const linhas = [
    [SA.uso, u.usado === null ? SA.semDado : SA.usoValor(formatarBytes(u.usado), formatarBytes(u.cota))],
    [SA.permanente, u.persistente === null ? SA.semDado : u.persistente ? SA.permanenteSim : SA.permanenteNao],
    [SA.shell, formatarBytes(t.shell)], [SA.binarios, formatarBytes(t.binarios)], [SA.bibliotecas, formatarBytes(t.bibliotecas)], [SA.audio, formatarBytes(t.audio)],
  ];
  elSto.lista.replaceChildren(...linhas.flatMap(([n, v]) => {
    const dt = document.createElement('dt'); dt.textContent = n;
    const dd = document.createElement('dd'); dd.textContent = v; return [dt, dd];
  }));
  elSto.perm.hidden = u.persistente === true;
  elSto.atuTexto.textContent = `${SA.atualizacao}: ${swEsperando ? SA.nova : SA.atualizado}`;
  elSto.atu.hidden = !swEsperando;
  elSto.pers.replaceChildren(...disponiveis.map((p) => {
    const li = document.createElement('li');
    const nome = document.createElement('span'); nome.textContent = `${p.nome}: ${offline[p.arquivoVrm] ? SA.pronto : SA.naoPronto}`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = SA.baixar;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await baixarParaOffline(arquivosDe(p), (n, total) => { elSto.status.textContent = SA.baixando(n, total); });
        elSto.status.textContent = SA.baixou;
      } catch (e) { console.warn('[armazenamento] download offline:', e); elSto.status.textContent = SA.falhou(e.message); }
      b.disabled = false;
      desenharArmazenamento();
    });
    li.append(nome, b); return li;
  }));
  if (!temServiceWorker()) elSto.status.textContent = SA.semServiceWorker;
  else if (DEBUG) elSto.status.textContent = SA.emDebug;
}
elSto.perm.addEventListener('click', async () => { elSto.status.textContent = (await pedirPersistencia()) ? '' : SA.pediuNegado; desenharArmazenamento(); });
elSto.atu.addEventListener('click', () => aplicarAtualizacao(swEsperando));
for (const [botao, categoria] of [[elSto.apBin, 'binarios'], [elSto.apLib, 'bibliotecas'], [elSto.apAudio, 'audio'], [elSto.apTudo, 'tudo']]) {
  botao.addEventListener('click', async () => { elSto.status.textContent = SA.apagou(await apagarCategoria(categoria)); desenharArmazenamento(); });
}
dlg.addEventListener('toggle', () => { if (dlg.open) desenharArmazenamento(); });

// Registro do worker. Com ?debug fica desligado: os testes e a depuração não podem ver código guardado.
if (!DEBUG) registrarSW(VERSAO, { aoNova: (reg) => { swEsperando = reg; if (dlg.open) desenharArmazenamento(); } });
// Pedir armazenamento permanente no primeiro toque da pessoa (precisa de um gesto do usuário).
document.addEventListener('pointerdown', () => { if (!DEBUG) pedirPersistencia(); }, { once: true });

/* ---------- Galeria de animações (painel) ---------- */
// O operador vê cada clipe tocando no personagem atual, liga ou desliga e marca "ok para criança".
let catalogo = null;
const elGaleria = $('galeria'), modoInfantil = $('modoInfantil');
modoInfantil.checked = ler('modo_infantil', 'sim') === 'sim';
modoInfantil.addEventListener('change', () => { gravar('modo_infantil', modoInfantil.checked ? 'sim' : 'nao'); renderizarGaleria(); });

function fmtDur(s) { return `${Number(s).toFixed(1).replace('.', ',')} s`; }

function renderizarGaleria() {
  if (!catalogo) { elGaleria.replaceChildren(); $('galeriaLacunas').textContent = T.galeria.semCatalogo; return; }
  const clipes = aplicarEscolhas(catalogo).filter((c) => !modoInfantil.checked || c.infantilOk);
  elGaleria.replaceChildren(...clipes.map((c) => {
    const li = document.createElement('li');
    li.dataset.status = c.status;
    li.dataset.id = c.id;
    li.innerHTML = `
      <div class="g-topo"><span class="g-nome"></span><span class="g-meta"></span></div>
      <p class="g-desc"></p>
      <div class="g-ctrl">
        <button class="btn ghost g-tocar" type="button">Tocar</button>
        <button class="btn ghost g-pausar" type="button" aria-pressed="false">Pausar</button>
        <label>Velocidade <select class="g-vel"><option>0.5</option><option>0.75</option><option selected>1</option><option>1.5</option></select></label>
        <label class="check"><input type="checkbox" class="g-ligado"> Ligado</label>
        <label class="check"><input type="checkbox" class="g-crianca"> Ok para criança</label>
        ${c.enviado ? '<button class="btn ghost g-apagar" type="button">Apagar</button>' : ''}
      </div>`;
    li.querySelector('.g-nome').textContent = c.id;
    li.querySelector('.g-meta').textContent = T.galeria.meta(fmtDur(c.duracao), c.loop, c.intensidade);
    li.querySelector('.g-desc').textContent = c.descricao;
    const ligado = li.querySelector('.g-ligado'), crianca = li.querySelector('.g-crianca');
    ligado.checked = c.status === 'ativo';
    crianca.checked = !!c.infantilOk;
    ligado.addEventListener('change', () => { gravarEscolha(catalogo, c.id, 'status', ligado.checked ? 'ativo' : 'desligado'); li.dataset.status = ligado.checked ? 'ativo' : 'desligado'; });
    crianca.addEventListener('change', () => { gravarEscolha(catalogo, c.id, 'infantilOk', crianca.checked); if (modoInfantil.checked && !crianca.checked) renderizarGaleria(); });
    const vel = li.querySelector('.g-vel'), pausar = li.querySelector('.g-pausar');
    li.querySelector('.g-tocar').addEventListener('click', async () => {
      if (!avatar) return;
      const clipe = await clipeDoArquivo(c.arquivo, avatar.vrm);
      if (!clipe) { li.querySelector('.g-desc').textContent = T.galeria.naoAbriu(c.arquivo); return; }
      dlg.classList.add('espiando');
      pausar.setAttribute('aria-pressed', 'false'); pausar.textContent = T.galeria.pausar;
      avatar.previa.tocar(clipe, { velocidade: Number(vel.value), laco: c.loop });
    });
    pausar.addEventListener('click', () => {
      if (!avatar || !avatar.previa.ativa) return;
      const p = pausar.getAttribute('aria-pressed') !== 'true';
      avatar.previa.pausar(p);
      pausar.setAttribute('aria-pressed', String(p)); pausar.textContent = p ? T.galeria.continuar : T.galeria.pausar;
    });
    vel.addEventListener('change', () => avatar && avatar.previa.velocidade(Number(vel.value)));
    const apagar = li.querySelector('.g-apagar');
    if (apagar) apagar.addEventListener('click', () => apagarEnviado(c.id));
    return li;
  }));
  const ocultos = catalogo.clipes.length - clipes.length;
  $('galeriaLacunas').textContent =
    (ocultos ? `${ocultos} clipe(s) escondido(s) pelo modo infantil. ` : '') +
    T.galeria.lacunas(catalogo.lacunas.map((l) => l.id).join(', '));
}

dlg.addEventListener('close', () => {
  dlg.classList.remove('espiando');
  if (avatar) avatar.previa.parar();
  if (personagem) diretor = novoDiretor(personagem); // vale o que foi ligado/desligado na galeria
});
const elCalmo = $('modoCalmo');
elCalmo.checked = ler('modo_calmo', 'nao') === 'sim';
elCalmo.addEventListener('change', () => gravar('modo_calmo', elCalmo.checked ? 'sim' : 'nao'));
function renderizarLicencas() {
  const ul = $('listaLicencas');
  if (!licencas.size) { ul.textContent = T.licenca.nenhum; return; }
  ul.replaceChildren(...[...licencas].map(([id, l]) => {
    const p = buscarPersonagem(id);
    const li = document.createElement('li');
    li.dataset.decisao = l.decisao;
    const nome = document.createElement('strong');
    nome.textContent = `${p ? p.nome : id}: ${T.licenca.decisao[l.decisao]}`;
    li.append(nome, document.createElement('br'), `${l.titulo} | ${l.autor} | VRM ${l.versao} | ${l.licenca}`);
    for (const m of [...l.bloqueio, ...l.conferir]) li.append(document.createElement('br'), m);
    return li;
  }));
}
dlg.addEventListener('toggle', () => { if (dlg.open) { preencherUsos(); renderizarGaleria(); renderizarLicencas(); } });

/* ---------- Enviar movimento (.fbx do Mixamo ou .vrma) ---------- */
// O arquivo fica só neste navegador (IndexedDB). Antes de entrar na galeria, toca no personagem e mostra as medidas.
const elEnvio = { arquivo: $('envArquivo'), nome: $('envNome'), uso: $('envUso'), btn: $('envEnviar'), saida: $('envSaida') };

function usosPossiveis() {
  return catalogo ? Object.keys(catalogo.estados).filter((k) => !k.startsWith('_')) : [];
}
function preencherUsos() {
  const atual = elEnvio.uso.value;
  const nenhum = document.createElement('option'); nenhum.value = ''; nenhum.textContent = T.galeria.soNaGaleria;
  elEnvio.uso.replaceChildren(nenhum, ...usosPossiveis().map((u) => { const o = document.createElement('option'); o.value = u; o.textContent = u; return o; }));
  elEnvio.uso.value = atual;
}

function registroDoEnviado(m) {
  return {
    id: m.id, arquivo: 'enviado:' + m.id, descricao: m.descricao, casoDeUso: m.uso ? [m.uso] : [],
    loop: !!m.medidas.pareceLaco, duracao: m.medidas.duracao, intensidade: 1, infantilOk: true,
    origem: `enviado pelo operador (${m.nomeArquivo})`,
    licenca: m.tipo === 'fbx' ? T.envio.licencaFbx : T.envio.licencaVrma,
    status: 'ativo', enviado: true,
  };
}
function incluirNoCatalogo(m) {
  registrarEnviado(m.id, URL.createObjectURL(m.blob), m.tipo);
  catalogo.clipes = catalogo.clipes.filter((c) => c.id !== m.id).concat(registroDoEnviado(m));
}

async function carregarEnviados() {
  try {
    for (const m of await listarMovimentos()) incluirNoCatalogo(m);
  } catch (e) {
    console.error('[movimentos] não consegui ler os movimentos enviados:', e);
  }
}

async function apagarEnviado(id) {
  try {
    await apagarMovimento(id);
  } catch (e) {
    console.error('[movimentos] não apagou:', e);
    elEnvio.saida.textContent = T.envio.naoApagou;
    return;
  }
  esquecerEnviado(id);
  catalogo.clipes = catalogo.clipes.filter((c) => c.id !== id);
  const extra = lerJSON('estados_extra', {});
  for (const [g, v] of Object.entries(extra)) if (v === id) delete extra[g];
  gravarJSON('estados_extra', extra);
  if (personagem) diretor = novoDiretor(personagem);
  renderizarGaleria();
}

elEnvio.btn.addEventListener('click', async () => {
  const f = elEnvio.arquivo.files[0];
  const saida = (t) => { elEnvio.saida.textContent = t; };
  if (!f) { saida(T.envio.escolhaArquivo); return; }
  const tipo = /\.fbx$/i.test(f.name) ? 'fbx' : /\.vrma$/i.test(f.name) ? 'vrma' : null;
  if (!tipo) { saida(T.envio.tipoInvalido); return; }
  if (!avatar) { saida(T.envio.espereCarregar); return; }
  const nome = elEnvio.nome.value.trim() || f.name.replace(/\.[^.]+$/, '');
  const id = idDoNome(nome);
  saida(T.envio.convertendo);
  elEnvio.btn.disabled = true;
  try {
    const blob = new Blob([await f.arrayBuffer()], { type: 'application/octet-stream' });
    registrarEnviado(id, URL.createObjectURL(blob), tipo);
    const clipe = await clipeDoArquivo('enviado:' + id, avatar.vrm);
    if (!clipe) {
      esquecerEnviado(id);
      saida(tipo === 'fbx' ? 'Não consegui ler esse FBX. Baixe do Mixamo em FBX, "Without Skin".' : 'Esse .vrma não abriu.');
      return;
    }
    const medidas = medirClipe(clipe, avatar.vrm);
    const m = { id, nome, nomeArquivo: f.name, tipo, blob, uso: elEnvio.uso.value || null, medidas, descricao: `${nome} (enviado)`, enviadoEm: new Date().toISOString() };
    await salvarMovimento(m);
    incluirNoCatalogo(m);
    if (m.uso) gravarJSON('estados_extra', { ...lerJSON('estados_extra', {}), [m.uso]: id });
    diretor = novoDiretor(personagem);
    const avisos = avisosDasMedidas(medidas);
    saida(T.envio.pronto(fmtDur(medidas.duracao), m.uso) +
      (avisos.length ? T.envio.comAvisos(avisos.join('; ')) : T.envio.semAvisos) + T.envio.olheAPrevia);
    renderizarGaleria();
    dlg.classList.add('espiando');
    avatar.previa.tocar(clipe, { laco: false });
  } catch (e) {
    console.error('[movimentos] envio falhou:', e);
    esquecerEnviado(id);
    saida(/quota/i.test(String(e)) ? T.envio.semEspaco : T.envio.falhou);
  } finally {
    elEnvio.btn.disabled = false;
  }
});

$('opIniciar').addEventListener('click', () => { voz.preparar(); dlg.close(); iniciarSessao('operador'); });
$('opEncerrar').addEventListener('click', () => { dlg.close(); encerrarSessao('operador'); });
const elInativ = $('opInatividade');
elInativ.value = inatividadeS();
elInativ.addEventListener('change', () => { const v = Math.max(15, Math.min(600, Number(elInativ.value) || 90)); elInativ.value = v; gravar('inatividade_s', String(v)); tocarInatividade(); });

const elOcioso = $('opSelecaoOcioso'), elVitTempo = $('opVitrineTempo');
elOcioso.value = selecaoOciosoMs() / 1000;
elOcioso.addEventListener('change', () => { const v = Math.max(10, Math.min(600, Number(elOcioso.value) || 60)); elOcioso.value = v; gravar('selecao_ocioso_s', String(v)); tocarOciosoSelecao(); });
elVitTempo.value = Number(ler('vitrine_s', '10')) || 10; // o campo mostra o que foi guardado; o modo ?debug não muda o que o operador vê
elVitTempo.addEventListener('change', () => { const v = Math.max(3, Math.min(60, Number(elVitTempo.value) || 10)); elVitTempo.value = v; gravar('vitrine_s', String(v)); if (etapa === 'atracao') iniciarVitrine(); });

const elFixar = $('fixarLugar');
elFixar.checked = fixarNoLugar();
elFixar.addEventListener('change', () => gravar('fixar_lugar', elFixar.checked ? 'sim' : 'nao'));

/* ---------- Créditos (gerados dos CREDITS.md) ---------- */
// Lê as tabelas dos dois CREDITS.md e mostra arquivo, autor ou origem, e licença.
// A frase de crédito do pacote VRoid aparece em destaque, como o readme exige para uso comercial.
const FONTES_CREDITO = [
  ['Personagens', 'assets/avatars/CREDITS.md'],
  ['Animações e lip sync', 'assets/animations/CREDITS.md'],
];
function tabelasMarkdown(md) {
  const linhas = md.split(/\r?\n/).filter((l) => /^\|.*\|\s*$/.test(l));
  const tabelas = [];
  let atual = null;
  for (const l of linhas) {
    const cel = l.trim().slice(1, -1).split('|').map((c) => c.trim().replace(/`/g, ''));
    if (cel.every((c) => /^:?-+:?$/.test(c))) continue;
    if (!atual || cel.length !== atual.cab.length) { atual = { cab: cel, linhas: [] }; tabelas.push(atual); continue; }
    atual.linhas.push(Object.fromEntries(atual.cab.map((c, i) => [c, cel[i]])));
  }
  return tabelas;
}
async function montarCreditos() {
  const corpo = $('creditosCorpo');
  corpo.replaceChildren();
  try {
    for (const [titulo, url] of FONTES_CREDITO) {
      const md = await (await fetch(url)).text();
      const h = document.createElement('h3'); h.textContent = titulo; corpo.appendChild(h);
      const frase = md.match(/"(Animation credits to [^"]+)"/);
      if (frase) { const p = document.createElement('p'); p.className = 'frase-credito'; p.textContent = frase[1]; corpo.appendChild(p); }
      const ul = document.createElement('ul');
      for (const t of tabelasMarkdown(md)) for (const r of t.linhas) {
        const nome = r['Arquivo'] || '';
        const quem = r['Autor (meta)'] || r['Autor (meta do VRM)'] || r['Origem'] || r['Nome no readme'] || '';
        const lic = r['Licença'] || r['Licença (meta, VRM 0.x)'] || '';
        if (!nome) continue;
        const li = document.createElement('li');
        li.textContent = nome + ' ';
        const s = document.createElement('span');
        // Notas para quem mantém o projeto (gitignore, commit) não vão para a tela.
        const limpar = (t) => t.replace(/\.?\s*No \.gitignore\.?/gi, '').replace(/\(ver meta\)/g, '').trim();
        s.textContent = [limpar(quem), limpar(lic)].filter(Boolean).join(' | ');
        li.appendChild(s);
        ul.appendChild(li);
      }
      corpo.appendChild(ul);
    }
    const h = document.createElement('h3'); h.textContent = T.creditos.terceiros; corpo.appendChild(h);
    const p = document.createElement('p'); p.textContent = T.creditos.terceirosLista; corpo.appendChild(p);
  } catch (e) {
    console.error('[creditos]', e);
    corpo.textContent = T.creditos.erro;
  }
}
$('abrirCreditos').addEventListener('click', async () => { await montarCreditos(); $('creditos').showModal(); });
$('fecharCreditos').addEventListener('click', () => $('creditos').close());

// Gancho para testes automatizados e inspeção no console; só existe com ?debug na URL.
if (new URLSearchParams(location.search).has('debug')) {
  window.__prof3d = {
    cena, historicos, trocarPersonagem, buscarPersonagem, voz, mesa, config, boca, quadro, camera, camCfg,
    get presente() { return presenca.presente; },
    get ultimaLeitura() { return ultimaLeitura; },
    get ajustes() { return ajustes; },
    get avatar() { return avatar; },
    get personagem() { return personagem; },
    get disponiveis() { return disponiveis.map((p) => p.id); },
    get estado() { return app.dataset.state; },
    get catalogo() { return catalogo; },
    get diretor() { return diretor; },
    licencas,
    registroGestos, pedirGesto, iniciarSessao, encerrarSessao, medidasSessao, definirEstado,
    diagnostico, custo, vigia, recarregarAvatar, VERSAO, irPara, andar, retratos, definirEtapa, desenharVitrine, visualizador, get usoGemini() { return usoGemini; },
    get etapa() { return etapa; },
    // Só para testes que não são do fluxo: pula atração, cumprimento e consentimento.
    irParaConversa(mic = 'sim') { sessaoAtiva = true; microfone = mic; definirEtapa('conversa'); },
    get sessaoAtiva() { return sessaoAtiva; },
  };
}

/* ---------- Início ---------- */
// Sem catálogo o corpo fica na pose do arquivo e não há gestos; o motivo vai para o console.
try { catalogo = await carregarCatalogo(); await carregarEnviados(); } catch (e) { console.error('[animacoes] catálogo não carregou:', e); }
const checagens = await Promise.all(PERSONAGENS.map(async (p) => [p, await verificarArquivo(p.arquivoVrm)]));
for (const [p, versao] of checagens) if (versao && !p.emBreve) { disponiveis.push(p); versoes.set(p.id, versao); }
renderizarSelecao();
// Base de conhecimento: vê, sem baixar nada, quais personagens já têm o índice pronto.
for (const p of disponiveis) rag.verificar(p.id).catch((e) => console.warn(`[rag] verificação de ${p.id} falhou:`, e));
cena.iniciar();
// Qualidade adaptativa por FPS. Com ?debug fica desligada, para as medições não mudarem sozinhas (qualidade_auto=sim liga).
cena.qualidadeAuto(!DEBUG || ler('qualidade_auto', 'nao') === 'sim');
vigia.iniciar();

if (!disponiveis.length) {
  $('loading').hidden = true;
  aplicarPaleta(PERSONAGENS[0].paleta);
  mostrarErroAvatar(T.avatar.nenhum, PERSONAGENS.map((p) => p.arquivoVrm).join(', '));
  $('painel').hidden = true;
} else {
  const salvo = buscarPersonagem(ler('personagem'));
  await trocarPersonagem(disponiveis.includes(salvo) ? salvo : disponiveis[0]);
  // Depois da carga do .vrm: o parse ocupa a thread principal e estouraria o tempo limite.
  await voz.verificarServidor();
  if (personagem) prepararFrasesFixas(personagem); // agora o motor (Kokoro ou sistema) já é conhecido
  if (etapa === 'atracao') definirEtapa('atracao'); // um teste pode já ter pulado para a conversa
  prepararMiniaturas();
  await ouvido.preparar();
  estadoOcioso();
  // Chegou inteiro até aqui: a contagem de recargas do vigia recomeça do zero.
  esquecerRecargas();
}
