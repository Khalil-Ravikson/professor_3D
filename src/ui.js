import { criarCena } from './scene.js';
import {
  carregarVrm, checarVrm, registrarChecklist, montarAvatar, descartarVrm,
  verificarArquivo, gerarMiniatura, carregarClipes, clipeDoArquivo, registrarEnviado, esquecerEnviado, AvatarAusenteError,
} from './avatar.js';
import { listarMovimentos, salvarMovimento, apagarMovimento, idDoNome, medirClipe, avisosDasMedidas } from './movimentos.js';
import { carregarCatalogo, aplicarEscolhas, gravarEscolha } from './animacoes.js';
import { criarDiretor, removerMarcas, instrucaoGestos, ESTADOS_BASE } from './gestos.js';
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
import { criarMedidorDeCusto, CAMBIO_PADRAO } from './custo.js';
import { VERSAO, VERSAO_DATA, VERSAO_MARCO } from './versao.js';

const $ = (id) => document.getElementById(id);
const app = $('app'), stage = $('stage'), elStatus = $('status'), elHeard = $('heard'), elAnswer = $('answer');
const micBtn = $('mic'), stopBtn = $('stop'), form = $('form'), input = $('text');
const dlg = $('settings'), keyInput = $('key'), voiceSel = $('voiceSel'), elenco = $('elenco');
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

const ROTULOS = {
  idle: 'Aperte o microfone e fale!',
  listening: 'Estou ouvindo... aperte de novo quando terminar',
  thinking: 'Pensando...',
  speaking: 'Falando...',
  error: 'Algo deu errado.',
};

function definirEstado(s, texto) {
  if (s === 'loading-ear') { micBtn.disabled = true; elStatus.textContent = 'Preparando o ouvido...'; return; }
  app.dataset.state = s;
  // Microfone aberto: o personagem continua audível, mas sai da frente de quem fala.
  if (mesa) mesa.abaixarFundo(s === 'listening');
  elStatus.textContent = texto || ROTULOS[s];
  stopBtn.hidden = !(s === 'speaking' || s === 'thinking');
  if (s === 'idle') micBtn.disabled = false;
}

function estadoOcioso() {
  definirEstado('idle', apiKey ? undefined : 'Um adulto precisa colocar a chave do Gemini na engrenagem.');
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
  aoMudar: () => { gravarJSON('custo', custo.estado); desenharDiagnostico(); },
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
  cartao: '--cartao', acao: '--acao', acaoSombra: '--acao-sombra', realce: '--realce',
  realceTinta: '--realce-tinta', ok: '--ok', fonte: '--fonte',
};
function aplicarPaleta(p) {
  const raiz = document.documentElement.style;
  for (const [k, v] of Object.entries(MAPA_PALETA)) if (p[k]) raiz.setProperty(v, p[k]);
}

// motivo: texto próprio (ex.: licença); sem motivo, a mensagem padrão de arquivo ausente com o caminho.
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function mostrarErroAvatar(titulo, caminho, motivo = '') {
  $('erroTitulo').textContent = titulo;
  $('erroCaminho').textContent = caminho;
  $('erroArquivo').hidden = !!motivo;
  $('erroMotivo').hidden = !motivo;
  $('erroMotivo').textContent = motivo;
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

/* ---------- Seletor ---------- */
function renderizarElenco() {
  elenco.replaceChildren(...disponiveis.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.id = p.id;
    b.setAttribute('aria-pressed', 'false');
    b.style.setProperty('--card-fundo', p.paleta.fundo2);
    b.style.setProperty('--card-tinta', p.paleta.tinta);
    b.style.setProperty('--card-suave', p.paleta.tintaSuave);
    const foto = document.createElement('span');
    foto.className = 'card-foto';
    foto.textContent = p.nome[0];
    const texto = document.createElement('span');
    texto.className = 'card-texto';
    const nome = document.createElement('span'); nome.className = 'card-nome'; nome.textContent = p.nome;
    const papel = document.createElement('span'); papel.className = 'card-papel'; papel.textContent = p.papel;
    texto.append(nome, papel);
    b.append(foto, texto);
    b.title = `${p.nome}: ${p.papel}`;
    return b;
  }));
  $('elencoNav').hidden = disponiveis.length < 2;
}

function marcarCardAtivo(id) {
  for (const b of elenco.querySelectorAll('.card')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
}

function colocarMiniatura(id, url) {
  const foto = elenco.querySelector(`.card[data-id="${id}"] .card-foto`);
  if (!foto) return;
  const img = document.createElement('img');
  img.src = url; img.alt = ''; img.width = 48; img.height = 48;
  foto.replaceChildren(img);
}

// Gera em sequência (um modelo por vez em memória) só as miniaturas que faltam no cache.
async function prepararMiniaturas() {
  // v2: miniaturas feitas já com o idle aplicado (antes do M4 eram com a pose provisória).
  const cache = lerJSON('miniaturas_v2', {});
  for (const p of disponiveis) {
    const versao = versoes.get(p.id);
    const salvo = cache[p.id];
    if (salvo && salvo.versao === versao) { colocarMiniatura(p.id, salvo.url); continue; }
    try {
      const url = await gerarMiniatura(p.arquivoVrm, { idle: 'assets/animations/idle.vrma' });
      cache[p.id] = { versao, url };
      gravarJSON('miniaturas_v2', cache);
      colocarMiniatura(p.id, url);
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
  gravar('personagem', p.id);
  aplicarPaleta(p.paleta);
  document.title = `${p.nome} 3D`;
  micBtn.setAttribute('aria-label', `Falar com ${p.nome}`);
  marcarCardAtivo(p.id);
  if (etapa === 'atracao') definirEtapa('atracao'); // o convite usa o nome do personagem
  renderizarAtalhos(p.atalhos);
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
    cena.definirFoco(avatar.posicaoCabeca, p.enquadramento);
    // Gestos ativos já ficam prontos, para o primeiro aceno não esperar o download.
    await Promise.all(diretor.gestosValidos().flatMap((g) => diretor.clipesDe(g)).map((c) => clipeDoArquivo(c.arquivo, vrm)));
    if (minha !== carga) return;
    if (sessaoAtiva) pedirGesto('aceno', 'fluxo');
    // Cumprimento e despedida já sintetizados: a fala sai ~300 ms depois do aceno, sem esperar o Kokoro.
    prepararFrasesFixas(p);
  } catch (e) {
    if (minha !== carga) return;
    console.error(`[avatar] ${p.nome}:`, e);
    if (e instanceof AvatarAusenteError) mostrarErroAvatar(`Falta o arquivo do avatar de ${p.nome}.`, p.arquivoVrm);
    else mostrarErroAvatar(`O arquivo do avatar de ${p.nome} não abriu. Confira se é um .vrm válido.`, p.arquivoVrm);
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

elenco.addEventListener('click', (e) => {
  const b = e.target.closest('.card');
  if (!b) return;
  const p = buscarPersonagem(b.dataset.id);
  if (p) trocarPersonagem(p);
});

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
  aoTerminarFala: () => { falando = false; if (!ocupado) estadoOcioso(); liberarGesto(); tocarInatividade(); avancarDepoisDaFala(); },
  aoFimFrase: () => liberarGesto(),
  // Gesto marcado pelo LLM numa sentença: pedido no instante em que essa sentença começa a tocar.
  aoInicioFrase: (gestos) => { for (const g of gestos) pedirGesto(g, 'llm', { naFronteira: true }); },
  aoPalavra: () => { if (boca) boca.marcarPalavra(); },
  aoStatus: mostrarStatusVoz,
  aoMudarVozesSistema: (vozes, manual) => {
    const auto = document.createElement('option');
    auto.value = ''; auto.textContent = 'Automática por personagem';
    voiceSel.replaceChildren(auto, ...vozes.map((v) => {
      const o = document.createElement('option'); o.value = v.name; o.textContent = `${v.name} (${v.lang})`; return o;
    }));
    voiceSel.value = manual ? manual.name : '';
  },
  aoProgressoNavegador: (pct) => { elStatusVoz.textContent = `Baixando o modelo Kokoro para o navegador... ${pct}%`; },
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
function mostrarStatusVoz({ motor, aviso, servidor }) {
  ultimoMotorVoz = motor;
  const s = servidor || {};
  const natural = motor && motor.id === 'webspeech' && motor.temNatural;
  let selo = motor ? (natural ? 'Voz: Edge Natural' : motor.id === 'webspeech' ? 'Voz do sistema' : motor.id === 'kokoro-browser' ? 'Voz: Kokoro no navegador' : 'Voz: Kokoro') : 'Voz: verificando';
  if (aviso) selo = aviso.startsWith('Servidor') ? 'Voz do sistema: servidor Kokoro fora do ar' : 'Voz do sistema';
  elSeloVoz.textContent = selo;
  elSeloVoz.dataset.alerta = aviso ? 'sim' : 'nao';
  const linhaServidor = s.ok === true ? `Servidor respondendo (${s.detalhe}).` : s.ok === false ? `Servidor ${s.detalhe}.` : 'Verificando o servidor...';
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

function definirEtapa(e) {
  etapa = e;
  app.dataset.etapa = e;
  clearTimeout(timerEtapa);
  app.dataset.microfone = microfone === 'sim' ? 'sim' : 'nao';
  usarVozBtn.hidden = !(e === 'conversa' && microfone === 'nao');
  usarVozBtn.textContent = T.etapas.conversa.mudarParaVoz;
  const p = personagem ? personagem.nome : '';
  if (e === 'atracao') {
    mostrarPasso(T.etapas.atracao.titulo(p), T.etapas.atracao.texto, '', T.etapas.atracao.acao, null);
  } else if (e === 'consentimento') {
    const c = T.etapas.consentimento;
    mostrarPasso(c.titulo, c.texto, camera.ligada ? c.camLigada : c.camDesligada, c.acao, c.alternativa);
  } else {
    elPasso.caixa.hidden = true;
  }
  // Etapas que esperam o fim de uma fala têm um limite, para nunca travarem sem voz.
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
  if (etapa === 'atracao') iniciarSessao('toque');
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
  if (sessaoAtiva) timerInatividade = setTimeout(() => encerrarSessao('inatividade'), inatividadeS() * 1000);
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
  for (const f of [ef.oiPresenca, ef.despedida]) if (f) voz.preSintetizar(f, ef.voz);
}

function iniciarSessao(origem) {
  if (sessaoAtiva || !personagem || !avatar || ocupado) return false;
  sessaoAtiva = true;
  app.dataset.sessao = 'ativa';
  definirEtapa('cumprimento');
  acenarEFalar('cumprimento', origem, efetivo(personagem).oiPresenca);
  tocarInatividade();
  return true;
}

function encerrarSessao(origem) {
  if (!sessaoAtiva || !personagem) return false;
  sessaoAtiva = false;
  app.dataset.sessao = 'encerrada';
  clearTimeout(timerInatividade);
  if (abortCtl) abortCtl.abort();
  silenciar();
  definirEtapa('despedida');
  acenarEFalar('despedida', origem, efetivo(personagem).despedida);
  // Limpeza: nenhuma conversa fica para a próxima pessoa.
  for (const h of historicos.values()) h.length = 0;
  quadro.limpar('');
  if (personagem.quadro) mostrarQuadroDe(personagem, historicoDe(personagem.id));
  return true;
}

stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, input, select, textarea, form, a, .quadro')) return;
  voz.preparar();
  iniciarSessao('toque');
});

/* ---------- Pergunta ---------- */
async function perguntarAoPersonagem(q) {
  q = (q || '').trim();
  if (!q || ocupado || !personagem) return;
  if (!sessaoAtiva) { sessaoAtiva = true; app.dataset.sessao = 'ativa'; }
  if (etapa !== 'conversa') definirEtapa('conversa');
  tocarInatividade();
  if (!apiKey) { definirEstado('idle', 'Um adulto precisa colocar a chave do Gemini na engrenagem.'); dlg.showModal(); return; }
  const quem = personagem;
  const marca = diagnostico.marcarPergunta();
  marcaPergunta = marca;
  const ef = efetivo(quem);
  const hist = historicoDe(quem.id);
  silenciar(); ocupado = true;
  elHeard.textContent = 'Você: ' + q;
  elAnswer.textContent = '';
  definirEstado('thinking');
  if (ef.quadro) { elQuadro.hidden = false; quadro.limpar(q); }
  const contas = [];
  hist.push({ role: 'user', content: q });
  const ctl = new AbortController();
  abortCtl = ctl;
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
    const texto = await perguntarEmFluxo({
      apiKey, modelo: config.modelo, persona: ef.persona + instrucaoGestos(diretor ? diretor.gestosValidos() : []), historico: hist.slice(-9), signal: ctl.signal,
      temperatura: ef.temperatura, limitePalavras: ef.limitePalavras,
      ferramentas: Object.fromEntries((ef.ferramentas || []).filter((n) => FERRAMENTAS[n]).map((n) => [n, FERRAMENTAS[n]])),
      aoChamada: (nome, args, resultado) => {
        if (nome !== 'calcular' || ctl.signal.aborted) return;
        contas.push(resultado);
        quadro.adicionarConta(resultado);
      },
      aoTexto: (pedaco) => { marca.aoPrimeiroTexto(); return leitor ? leitor.adicionar(pedaco) : falar(pedaco); },
      aoUso: (uso) => custo.somar(config.modelo, uso),
    });
    if (leitor) leitor.finalizar();
    for (const f of divisor.finalizar()) falaTurno.adicionar(f);
    falaTurno.finalizar();
    if (personagem !== quem) { hist.pop(); return; }
    if (!texto) { hist.pop(); elAnswer.textContent = 'Hmm, não consegui responder isso. Vamos tentar outra pergunta?'; return; }
    hist.push({ role: 'assistant', content: texto.replace(/\[gesto:[^\]]*\]\s*/gi, ''), contas });
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
      elAnswer.textContent = [401, 403].includes(e.status) ? 'A chave da API não foi aceita. Confira na engrenagem.'
        : e.status === 400 ? `O Gemini recusou o pedido (400): ${motivo}`
        : e.status === 429 ? 'Muitas perguntas de uma vez. Espere um pouquinho!'
        : `Ops, deu erro (${e.status}). Tente de novo!`;
    } else {
      elAnswer.textContent = 'Não consegui falar com o Gemini. Confira a internet e tente de novo!';
    }
  } finally {
    ocupado = false;
    if (abortCtl === ctl) abortCtl = null;
    if (!voz.emTurno && personagem === quem && app.dataset.state === 'thinking') estadoOcioso();
  }
}

/* ---------- Ouvido ---------- */
const ouvido = criarOuvido({
  aoOuvirParcial: (t) => { elHeard.textContent = 'Você: ' + t; },
  aoOuvirFinal: (t) => perguntarAoPersonagem(t),
  aoMudarEstado: definirEstado,
  aoProgresso: (pct) => { elStatus.textContent = `Preparando o ouvido... ${pct}%`; },
});

/* ---------- Controles ---------- */
micBtn.addEventListener('click', () => {
  voz.preparar();
  if (ouvido.gravando) { ouvido.alternar(); return; }
  if (abortCtl) abortCtl.abort();
  silenciar();
  ouvido.alternar();
});
stopBtn.addEventListener('click', () => { if (abortCtl) abortCtl.abort(); silenciar(); estadoOcioso(); });
$('chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  voz.preparar(); perguntarAoPersonagem(b.dataset.q);
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
  if (mudouUrl || voz.statusServidor.ok !== true) await voz.verificarServidor();
  else voz.resolverMotor(personagem && personagem.voz);
  if (config.motor === 'kokoro-browser') {
    try {
      await voz.navegador.carregar();
      mostrarStatusVoz({ motor: voz.navegador, aviso: null, servidor: await voz.navegador.verificar() });
    } catch (e) {
      console.error('[kokoro-browser] não carregou:', e);
      elStatusVoz.textContent = 'O Kokoro no navegador não carregou. Veja o console.';
    }
  }
}

/* ---------- Painel de diagnóstico (só o operador vê) ---------- */
const elDiag = $('diag'), elDiagErros = $('diagErros'), elCambio = $('diagCambio');
let timerDiag = null;

const fmtSeg = (s) => (s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`);

// Estado de cada serviço, com o motivo quando está ruim.
function estadoDosServicos() {
  const sv = voz.statusServidor || {};
  const lic = personagem ? licencas.get(personagem.id) : null;
  return {
    Gemini: apiKey ? `chave configurada, modelo ${config.modelo}` : 'sem chave',
    Voz: (ultimoMotorVoz ? ultimoMotorVoz.nome : 'escolhendo') +
      (sv.ok === true ? ' (servidor respondendo)' : sv.ok === false ? ` (servidor ${sv.detalhe})` : ''),
    Ouvido: ouvido.gravando ? 'ouvindo agora' : 'pronto',
    Câmera: camera && camera.ligada ? 'ligada' : 'desligada',
    Avatar: avatar ? `${personagem.nome} carregado${lic ? `, licença ${T.licenca.decisao[lic.decisao] || lic.decisao}` : ''}` : 'sem avatar',
  };
}

const RUIM = /sem chave|fora do ar|falhou|sem avatar|bloqueado/i;

function desenharDiagnostico() {
  if (!dlg.open) return;
  const r = diagnostico.retrato(estadoDosServicos());
  const g = custo.resumo();
  const linhas = [
    ['Versão', `${VERSAO} (${VERSAO_MARCO}, ${VERSAO_DATA})`, false],
    ['Em pé há', fmtSeg(r.emPe), false],
    ['Quadros por segundo', r.fps === null ? 'medindo' : String(r.fps), r.fps !== null && r.fps < 25],
    ['Imagem', r.contextoPerdido ? 'contexto perdido' : 'normal', r.contextoPerdido],
    ['Memória', r.memoria ? `${r.memoria.usadaMb} MB de ${r.memoria.limiteMb} MB` : 'o navegador não informa', false],
    ['Na placa de vídeo', r.gpu ? `${r.gpu.geometrias} geometrias, ${r.gpu.texturas} texturas` : 'sem dados', false],
    ['Resposta do Gemini', r.latencia.perguntaMs === null ? 'sem medida ainda' : `${r.latencia.perguntaMs} ms (mediana de ${r.latencia.amostras})`, false],
    ['Até a primeira fala', r.latencia.falaMs === null ? 'sem medida ainda' : `${r.latencia.falaMs} ms`, false],
    ['Respostas hoje', `${g.respostas} (${g.sessao.respostas} nesta sessão)`, false],
    ['Tokens hoje', `${g.entrada.toLocaleString('pt-BR')} de entrada, ${(g.saida + g.pensamento).toLocaleString('pt-BR')} de saída`, false],
    ['Gasto hoje', g.semPreco.length ? `US$ ${g.usd.toFixed(4)}, sem preço para ${g.semPreco.join(', ')}` : `R$ ${g.reais.toFixed(2)} (US$ ${g.usd.toFixed(4)})`, g.semPreco.length > 0],
    ['Recargas automáticas', String(contarRecargas()), contarRecargas() > 0],
    ['Erros', r.erros ? `${r.erros}, último às ${r.ultimoErro.t}` : 'nenhum', r.erros > 0],
  ];
  for (const [nome, valor] of Object.entries(r.servicos)) linhas.push([nome, valor, RUIM.test(valor)]);

  elDiag.replaceChildren(...linhas.flatMap(([nome, valor, alerta]) => {
    const dt = document.createElement('dt'); dt.textContent = nome;
    const dd = document.createElement('dd'); dd.textContent = valor;
    if (alerta) dd.dataset.alerta = 'sim';
    return [dt, dd];
  }));
  $('diagFonte').textContent = `Preços: ${g.fonte}. Sem preço do modelo na tabela, o gasto aparece só em tokens.`;
  elDiagErros.replaceChildren(...diagnostico.erros.slice(-5).reverse().map((e) => {
    const li = document.createElement('li');
    li.textContent = `${e.t} ${e.origem}: ${e.mensagem}`;
    return li;
  }));
}

elCambio.value = String(custo.resumo().cambio);
elCambio.addEventListener('change', () => {
  custo.definirCambio(elCambio.value);
  gravar('cambio', String(custo.resumo().cambio));
});
$('diagZerar').addEventListener('click', () => { custo.zerarSessao(); desenharDiagnostico(); });
$('diagContexto').addEventListener('click', () => {
  if (!cena.perderContextoDeProposito()) {
    $('diagFonte').textContent = 'Este navegador não deixa derrubar o contexto de propósito (falta WEBGL_lose_context).';
    return;
  }
  dlg.close();
});

$('gear').addEventListener('click', () => {
  dlg.showModal();
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
  if (!ocupado && !ouvido.gravando) definirEstado('idle', apiKey ? 'Tudo pronto!' : 'Falta a chave do Gemini.');
});
$('testVoice').addEventListener('click', async () => {
  voz.preparar(); silenciar();
  await aplicarConfigVoz();
  const p = personagem || disponiveis[0] || PERSONAGENS[0];
  const vozTeste = config.motor === 'kokoro-browser' ? { motor: 'kokoro-browser', id: 'af_heart', speed: 1 } : efetivo(p).voz;
  const frase = config.motor === 'kokoro-browser' ? `Hi, I am ${p.nome}. This is the English voice.` : `Oi! Eu sou ${p.nome}. Esta é a minha voz.`;
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
  iniciarSessao('rosto');
}

const camera = criarCamera({
  aoMudar: ({ estado, motivo }) => {
    const ligada = estado === 'ligada';
    camBtn.setAttribute('aria-pressed', String(ligada));
    camBtn.setAttribute('aria-label', ligada ? 'Desligar a câmera' : 'Ligar a câmera');
    camAviso.hidden = !ligada;
    camEstado.textContent = { ligando: 'Ligando a câmera...', ligada: `Câmera ligada (${camera.delegado || ''}).`, desligada: 'Câmera desligada.', erro: `A câmera não ligou: ${motivo}.` }[estado];
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
  temp: $('ajTemp'), tempValor: $('ajTempValor'), voz: $('ajVoz'), vel: $('ajVel'), velValor: $('ajVelValor'),
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
  const vel = Number(aj.vel.value);
  if (Math.abs(vel - base.voz.speed) > 1e-9) a.vozSpeed = vel;
  if (Object.keys(a).length) ajustes[base.id] = a; else delete ajustes[base.id];
  gravarJSON('ajustes_personagens', ajustes);
  aj.temp.disabled = aj.tempPadrao.checked;
  aj.tempValor.textContent = aj.tempPadrao.checked ? 'padrão' : Number(aj.temp.value).toFixed(1);
  aj.velValor.textContent = vel.toFixed(2);
}

aj.sel.addEventListener('change', preencherAjustes);
for (const el of [aj.persona, aj.limite, aj.temp, aj.voz, aj.vel]) el.addEventListener('input', salvarAjustes);
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

/* ---------- Galeria de animações (painel) ---------- */
// O operador vê cada clipe tocando no personagem atual, liga ou desliga e marca "ok para criança".
let catalogo = null;
const elGaleria = $('galeria'), modoInfantil = $('modoInfantil');
modoInfantil.checked = ler('modo_infantil', 'sim') === 'sim';
modoInfantil.addEventListener('change', () => { gravar('modo_infantil', modoInfantil.checked ? 'sim' : 'nao'); renderizarGaleria(); });

function fmtDur(s) { return `${Number(s).toFixed(1).replace('.', ',')} s`; }

function renderizarGaleria() {
  if (!catalogo) { elGaleria.replaceChildren(); $('galeriaLacunas').textContent = 'Catálogo de animações não carregou.'; return; }
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
    li.querySelector('.g-meta').textContent = `${fmtDur(c.duracao)} | ${c.loop ? 'laço' : 'uma vez'} | intensidade ${c.intensidade}`;
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
      if (!clipe) { li.querySelector('.g-desc').textContent = `Não abriu ${c.arquivo}. Confira se o arquivo está na pasta.`; return; }
      dlg.classList.add('espiando');
      pausar.setAttribute('aria-pressed', 'false'); pausar.textContent = 'Pausar';
      avatar.previa.tocar(clipe, { velocidade: Number(vel.value), laco: c.loop });
    });
    pausar.addEventListener('click', () => {
      if (!avatar || !avatar.previa.ativa) return;
      const p = pausar.getAttribute('aria-pressed') !== 'true';
      avatar.previa.pausar(p);
      pausar.setAttribute('aria-pressed', String(p)); pausar.textContent = p ? 'Continuar' : 'Pausar';
    });
    vel.addEventListener('change', () => avatar && avatar.previa.velocidade(Number(vel.value)));
    const apagar = li.querySelector('.g-apagar');
    if (apagar) apagar.addEventListener('click', () => apagarEnviado(c.id));
    return li;
  }));
  const ocultos = catalogo.clipes.length - clipes.length;
  $('galeriaLacunas').textContent =
    (ocultos ? `${ocultos} clipe(s) escondido(s) pelo modo infantil. ` : '') +
    `Faltam clipes para: ${catalogo.lacunas.map((l) => l.id).join(', ')}.`;
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
  const nenhum = document.createElement('option'); nenhum.value = ''; nenhum.textContent = 'Só na galeria';
  elEnvio.uso.replaceChildren(nenhum, ...usosPossiveis().map((u) => { const o = document.createElement('option'); o.value = u; o.textContent = u; return o; }));
  elEnvio.uso.value = atual;
}

function registroDoEnviado(m) {
  return {
    id: m.id, arquivo: 'enviado:' + m.id, descricao: m.descricao, casoDeUso: m.uso ? [m.uso] : [],
    loop: !!m.medidas.pareceLaco, duracao: m.medidas.duracao, intensidade: 1, infantilOk: true,
    origem: `enviado pelo operador (${m.nomeArquivo})`,
    licenca: m.tipo === 'fbx' ? 'Mixamo (termos da Adobe); não redistribuir' : 'conferir a licença do arquivo enviado',
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
    elEnvio.saida.textContent = 'Não consegui apagar. Veja o console.';
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
  if (!f) { saida('Escolha um arquivo .fbx (Mixamo) ou .vrma.'); return; }
  const tipo = /\.fbx$/i.test(f.name) ? 'fbx' : /\.vrma$/i.test(f.name) ? 'vrma' : null;
  if (!tipo) { saida('Só aceito .fbx do Mixamo ou .vrma.'); return; }
  if (!avatar) { saida('Espere o personagem carregar.'); return; }
  const nome = elEnvio.nome.value.trim() || f.name.replace(/\.[^.]+$/, '');
  const id = idDoNome(nome);
  saida('Convertendo...');
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
    saida(`Pronto: ${fmtDur(medidas.duracao)}${m.uso ? `, usado como "${m.uso}"` : ''}. ` +
      (avisos.length ? 'Atenção: ' + avisos.join('; ') + '.' : 'Corpo parado e começo e fim parecidos.') + ' Olhe a prévia: a mão na frente do rosto só se vê tocando.');
    renderizarGaleria();
    dlg.classList.add('espiando');
    avatar.previa.tocar(clipe, { laco: false });
  } catch (e) {
    console.error('[movimentos] envio falhou:', e);
    esquecerEnviado(id);
    saida(/quota/i.test(String(e)) ? 'Sem espaço no navegador para guardar o arquivo.' : 'O envio falhou. Veja o console.');
  } finally {
    elEnvio.btn.disabled = false;
  }
});

$('opIniciar').addEventListener('click', () => { voz.preparar(); dlg.close(); iniciarSessao('operador'); });
$('opEncerrar').addEventListener('click', () => { dlg.close(); encerrarSessao('operador'); });
const elInativ = $('opInatividade');
elInativ.value = inatividadeS();
elInativ.addEventListener('change', () => { const v = Math.max(15, Math.min(600, Number(elInativ.value) || 90)); elInativ.value = v; gravar('inatividade_s', String(v)); tocarInatividade(); });

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
    const h = document.createElement('h3'); h.textContent = 'Código de terceiros'; corpo.appendChild(h);
    const p = document.createElement('p'); p.textContent = 'three.js (MIT), @pixiv/three-vrm e o exemplo de Mixamo do three-vrm (MIT, pixiv Inc.), MediaPipe (Apache 2.0), Kokoro (Apache 2.0).'; corpo.appendChild(p);
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
    diagnostico, custo, vigia, recarregarAvatar, VERSAO,
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
for (const [p, versao] of checagens) if (versao) { disponiveis.push(p); versoes.set(p.id, versao); }
renderizarElenco();
cena.iniciar();
vigia.iniciar();

if (!disponiveis.length) {
  $('loading').hidden = true;
  aplicarPaleta(PERSONAGENS[0].paleta);
  mostrarErroAvatar('Nenhum avatar encontrado.', PERSONAGENS.map((p) => p.arquivoVrm).join(', '));
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
