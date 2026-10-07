// Página do laboratório de vozes (prompt 3, U4). Só do operador. A lógica de notas, resumo e recomendação está em
// src/tts/laboratorio.js (pura e testada); aqui ficam a geração, o tempo medido e a tela.
import { criarKokoroServidor } from './tts/kokoro-server.js';
import { criarElevenLabs, ELEVENLABS_FONTE, ELEVENLABS_AVISO_LICENCA } from './tts/elevenlabs.js';
import { criarImportado } from './tts/importado.js';
import { aplicarLexico } from './tts/lexico.js';
import { FRASES_LAB, CRITERIOS, FRASE_ESTABILIDADE, LIMIARES_PADRAO, montarAmostras, gerarRelatorio } from './tts/laboratorio.js';

const $ = (id) => document.getElementById(id);
const CANDIDATAS_PADRAO = [
  { id: 'kokoro-dora', nome: 'Kokoro pf_dora', motor: 'kokoro-server', voz: { id: 'pf_dora', speed: 0.95 } },
  { id: 'kokoro-alex', nome: 'Kokoro pm_alex', motor: 'kokoro-server', voz: { id: 'pm_alex', speed: 0.98 } },
  { id: 'eleven-flash', nome: 'ElevenLabs Flash v2.5', motor: 'elevenlabs', voz: { elevenlabs: { voiceId: '', modelo: 'eleven_flash_v2_5' } } },
  { id: 'eleven-multi', nome: 'ElevenLabs Multilingual v2', motor: 'elevenlabs', voz: { elevenlabs: { voiceId: '', modelo: 'eleven_multilingual_v2' } } },
  { id: 'naturalreader', nome: 'NaturalReader (MP3 importado)', motor: 'importado', voz: { importado: { rotulo: '' } } },
];
$('candidatas').value = JSON.stringify(CANDIDATAS_PADRAO, null, 2);

const ctx = new AudioContext();
const motores = {
  'kokoro-server': criarKokoroServidor({ obterUrl: () => $('urlKokoro').value }),
  elevenlabs: criarElevenLabs({ obterConfig: () => ({ proxy: $('urlProxy').value }) }),
  importado: criarImportado(),
};
const estado = (t, erro = false) => { $('estado').textContent = t; $('estado').className = erro ? 'erro' : ''; };

let vozes = [], medicoes = [], notas = [], amostras = [], indice = 0, lexico = null, ultimo = null;
const buffers = new Map(); // `${vozId}|${fraseId}|${rep}` -> AudioBuffer
const chave = (v, f, rep = 1) => `${v}|${f}|${rep}`;

async function carregarLexico() {
  try { const r = await fetch('assets/lexico-pronuncia.json', { cache: 'no-store' }); return r.ok ? await r.json() : null; }
  catch (e) { console.warn('[lab] sem léxico:', e); return null; }
}

async function gerar() {
  let lista;
  try { lista = JSON.parse($('candidatas').value); } catch (e) { estado(`JSON das candidatas inválido: ${e.message}`, true); return; }
  vozes = lista.filter((v) => {
    if (v.motor === 'elevenlabs') return v.voz && v.voz.elevenlabs && v.voz.elevenlabs.voiceId;
    if (v.motor === 'importado') return v.voz && v.voz.importado && v.voz.importado.rotulo;
    return motores[v.motor];
  });
  if (!vozes.length) { estado('Nenhuma candidata completa. Preencha voiceId (ElevenLabs) ou rotulo (importado).', true); return; }
  if (ctx.state === 'suspended') await ctx.resume();
  lexico = $('usarLexico').checked ? await carregarLexico() : null;
  medicoes = []; notas = []; buffers.clear(); indice = 0;
  $('gerar').disabled = true;
  const total = vozes.length * (FRASES_LAB.length + 1);
  let feitos = 0;
  for (const v of vozes) {
    const motor = motores[v.motor];
    if (v.motor === 'kokoro-server') {
      const st = await motor.verificar();
      if (!st.ok) { estado(`Kokoro fora do ar (${st.detalhe}). Ligue o servidor e gere de novo.`, true); $('gerar').disabled = false; return; }
    }
    // A frase de estabilidade entra duas vezes: a segunda geração é a repetição.
    const fila = [...FRASES_LAB.map((f) => ({ f, rep: 1 })), { f: FRASES_LAB.find((f) => f.id === FRASE_ESTABILIDADE), rep: 2 }];
    for (const { f, rep } of fila) {
      estado(`Gerando ${++feitos} de ${total}: ${v.nome}`);
      const texto = aplicarLexico(f.texto, v.motor, lexico);
      const t0 = performance.now();
      let med = {};
      try {
        const buf = await motor.sintetizar(texto, v.voz, { ctx, aoMedir: (m) => { med = m; } });
        buffers.set(chave(v.id, f.id, rep), buf);
        medicoes.push({ vozId: v.id, fraseId: f.id, repeticao: rep === 2 ? 2 : undefined, ok: true, ms: med.ms ?? performance.now() - t0, msCabecalho: med.msCabecalho, duracao: buf.duration, caracteres: texto.length, usd: med.usd ?? 0 });
      } catch (e) {
        medicoes.push({ vozId: v.id, fraseId: f.id, repeticao: rep === 2 ? 2 : undefined, ok: false, erro: String(e.message).slice(0, 160), ms: performance.now() - t0, caracteres: texto.length, usd: 0 });
      }
    }
  }
  const falhas = medicoes.filter((m) => !m.ok);
  estado(`Pronto: ${medicoes.length - falhas.length} amostras, ${falhas.length} falha(s). Avalie abaixo.`, falhas.length > 0);
  $('gerar').disabled = false;
  amostras = montarAmostras(vozes).filter((a) => buffers.has(chave(a.vozId, a.fraseId)));
  $('avaliacao').hidden = false; $('resultado').hidden = false;
  mostrar();
}

let fonteAtual = null;
function tocar() {
  const a = amostras[indice];
  if (!a) return;
  if (fonteAtual) { try { fonteAtual.stop(); } catch { /* já parada */ } }
  const f = ctx.createBufferSource();
  f.buffer = buffers.get(chave(a.vozId, a.fraseId));
  f.connect(ctx.destination);
  f.start();
  fonteAtual = f;
}

function mostrar() {
  const a = amostras[indice];
  if (!a) { $('codigo').textContent = 'Fim'; $('frase').textContent = 'Todas as amostras foram avaliadas. Gere o relatório.'; $('notas').replaceChildren(); $('tocar').disabled = true; return; }
  $('tocar').disabled = false;
  const frase = FRASES_LAB.find((f) => f.id === a.fraseId);
  $('codigo').textContent = a.codigo;
  $('frase').textContent = frase.texto;
  $('progresso').textContent = `${indice + 1} de ${amostras.length}`;
  const atual = notas.find((n) => n.vozId === a.vozId && n.fraseId === a.fraseId) || {};
  const caixa = $('notas'); caixa.replaceChildren();
  for (const c of CRITERIOS) {
    if (c.so === 'nomes' && !frase.nomes) continue;
    const rot = document.createElement('div'); rot.textContent = c.nome; rot.style.fontWeight = '600';
    const linha = document.createElement('div'); linha.className = 'nota'; linha.setAttribute('role', 'group'); linha.setAttribute('aria-label', c.nome);
    for (let n = 1; n <= 5; n++) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = String(n);
      b.setAttribute('aria-pressed', String(atual[c.id] === n));
      b.addEventListener('click', () => { atual[c.id] = n; for (const x of linha.children) x.setAttribute('aria-pressed', String(x === b)); });
      linha.append(b);
    }
    caixa.append(rot, linha);
  }
  caixa._atual = atual;
  setTimeout(tocar, 150);
}

function guardar() {
  const a = amostras[indice]; if (!a) return true;
  const atual = $('notas')._atual || {};
  const frase = FRASES_LAB.find((f) => f.id === a.fraseId);
  const faltam = CRITERIOS.filter((c) => !(c.so === 'nomes' && !frase.nomes) && !atual[c.id]);
  if (faltam.length) { estado(`Falta nota em: ${faltam.map((c) => c.nome).join(', ')}.`, true); return false; }
  estado('');
  const i = notas.findIndex((n) => n.vozId === a.vozId && n.fraseId === a.fraseId);
  const novo = { vozId: a.vozId, fraseId: a.fraseId, ...atual };
  if (i >= 0) notas[i] = novo; else notas.push(novo);
  return true;
}

function limiares() {
  return { ...LIMIARES_PADRAO, notaMinimaAoVivo: Number($('limNota').value), tempoMaxAoVivoMs: Number($('limTempo').value), estabilidadeMaxPct: Number($('limEst').value) };
}
function baixar(nome, texto, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function relatorio() {
  const cambio = Number($('cambio').value) || 5.17;
  const dados = { data: new Date().toISOString().slice(0, 10), cambio, limiares: limiares(), usouLexico: !!lexico, vozes: vozes.map((v) => ({ id: v.id, nome: v.nome, motor: v.motor })), frases: FRASES_LAB, medicoes, notas };
  const md = gerarRelatorio({ vozes: dados.vozes, medicoes, notas, limiares: dados.limiares, cambio, fontePrecos: `Preços do ElevenLabs: ${ELEVENLABS_FONTE}.` })
    + `\n## Licença\n\n${ELEVENLABS_AVISO_LICENCA}\n`;
  ultimo = { dados, md };
  $('saida').textContent = md;
  $('baixarJson').disabled = false; $('baixarMd').disabled = false;
}

$('gerar').addEventListener('click', gerar);
$('tocar').addEventListener('click', tocar);
$('proxima').addEventListener('click', () => { if (guardar() && indice < amostras.length) { indice++; mostrar(); } });
$('anterior').addEventListener('click', () => { if (indice > 0) { indice--; mostrar(); } });
$('relatorio').addEventListener('click', relatorio);
$('baixarJson').addEventListener('click', () => ultimo && baixar('laboratorio-vozes.json', JSON.stringify(ultimo.dados, null, 2), 'application/json'));
$('baixarMd').addEventListener('click', () => ultimo && baixar('laboratorio-vozes.md', ultimo.md, 'text/markdown'));
// Gancho para teste automatizado e para o operador conferir pelo console.
window.__lab = { get amostras() { return amostras; }, get medicoes() { return medicoes; }, get notas() { return notas; }, gerar, relatorio };
