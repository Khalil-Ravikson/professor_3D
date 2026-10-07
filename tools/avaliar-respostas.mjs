// Avaliação das respostas dos personagens (prompt 2, R7): 20 perguntas por personagem ativo, rubrica e detector de
// frases proibidas. Um comando:
//   node tools/avaliar-respostas.mjs            valida o banco de perguntas e o detector. NÃO chama o Gemini. Gasto zero.
//   node tools/avaliar-respostas.mjs --gastar   pergunta de verdade (40 perguntas, cerca de R$ 0,20 no 3.1 Flash-Lite,
//                                               ESTIMATIVA). Precisa da chave em .env.local e do teto do AI Studio acima do gasto.
// Saída: relatorios/avaliacao-respostas.json e .md, com as respostas para o dono dar nota de voz, método, concisão e segurança.
// A chave só existe em memória: lida de .env.local, entregue ao navegador e nunca impressa nem gravada em relatório.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { achadosProibidos } from '../src/frases-proibidas.js';

const gastar = process.argv.includes('--gastar');
const banco = JSON.parse(readFileSync('tests/avaliacao/perguntas.json', 'utf8'));
const PERSONAGENS = ['luma', 'matematico'];
const TIPOS = new Set(['voz', 'metodo', 'concisao', 'seguranca']);

// ---- validação do banco (sempre) ----
const problemas = [];
for (const id of PERSONAGENS) {
  const lista = banco[id] || [];
  if (lista.length !== 20) problemas.push(`${id}: ${lista.length} perguntas, o prompt pede 20`);
  const vistas = new Set();
  for (const q of lista) {
    if (!q.pergunta || !q.espera) problemas.push(`${id}: pergunta sem texto ou sem "espera"`);
    if (!TIPOS.has(q.tipo)) problemas.push(`${id}: tipo desconhecido "${q.tipo}"`);
    if (vistas.has(q.pergunta)) problemas.push(`${id}: pergunta repetida "${q.pergunta}"`);
    vistas.add(q.pergunta);
    if (/uema|vestibular|campus/i.test(q.pergunta)) problemas.push(`${id}: pergunta sobre a UEMA sem fonte oficial: "${q.pergunta}"`);
  }
}
// ---- o detector precisa pegar o que promete (sempre) ----
const casos = [
  ['Claro! O céu é azul.', 'abertura genérica'], ['O céu é azul — por causa da luz.', 'travessão'], ['O céu é azul 😀', 'emoji'],
  ['Sou uma inteligência artificial.', 'declara ser IA sem perguntarem'], ['Qual é o seu nome completo?', 'pede dado pessoal'],
  ['[emo:alegre] Oi.', 'marca de controle vazou'], ['FALA: oi', 'marca de controle vazou'], ['Espero que isso ajude.', 'enchimento'],
];
for (const [texto, esperado] of casos) if (!achadosProibidos(texto).includes(esperado)) problemas.push(`detector não pegou "${esperado}" em "${texto}"`);
if (achadosProibidos('O céu fica azul porque a luz azul se espalha mais no ar.', { pergunta: 'Por que o céu é azul?', falaMaxFrases: 4 }).length) problemas.push('detector acusou uma resposta boa');
if (achadosProibidos('Sou uma inteligência artificial.', { perguntouSeEhIA: true }).includes('declara ser IA sem perguntarem')) problemas.push('detector acusou IA mesmo com perguntaram');

console.log(`Banco: ${PERSONAGENS.map((id) => `${id} ${(banco[id] || []).length}`).join(', ')} perguntas. Detector: ${casos.length} casos.`);
if (problemas.length) { console.error('PROBLEMAS:\n- ' + problemas.join('\n- ')); process.exit(1); }
console.log('Validação ok (nenhuma chamada ao Gemini).');
if (!gastar) { console.log('Para perguntar de verdade: node tools/avaliar-respostas.mjs --gastar'); process.exit(0); }

// ---- rodada de verdade ----
if (!existsSync('.env.local')) { console.error('Sem .env.local com a chave. Não há o que rodar.'); process.exit(1); }
const chave = (readFileSync('.env.local', 'utf8').match(/^\s*[A-Z_]*KEY\s*=\s*(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!chave) { console.error('Chave não encontrada em .env.local.'); process.exit(1); }
const { chromium } = await import('@playwright/test');
const BASE = process.env.BASE || 'http://localhost:8771';
const navegador = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const resultados = [];
for (const id of PERSONAGENS) {
  for (const q of banco[id]) {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(([k, pid]) => { localStorage.clear(); localStorage.setItem('prof3d_gemini_key', k); localStorage.setItem('prof3d_personagem', pid); localStorage.setItem('prof3d_motor', 'webspeech'); }, [chave, id]);
    let resposta = '', quadro = '', erro = '';
    try {
      await page.goto(`${BASE}/?debug`);
      await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
      await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
      await page.fill('#text', q.pergunta);
      await page.click('#form button[type=submit]');
      await page.waitForFunction(() => { const h = [...window.__prof3d.historicos.values()].find((x) => x.length); return h && h[h.length - 1].role === 'assistant'; }, null, { timeout: 120_000 });
      resposta = await page.evaluate(() => document.getElementById('answer').textContent);
      quadro = await page.evaluate(() => (document.querySelector('.quadro') || {}).innerText || '');
    } catch (e) { erro = String(e.message).slice(0, 160); }
    await page.close();
    const achados = erro ? ['sem resposta'] : achadosProibidos(resposta, { pergunta: q.pergunta, falaMaxFrases: q.maxFrases, perguntouSeEhIA: !!q.perguntouSeEhIA });
    resultados.push({ personagem: id, pergunta: q.pergunta, tipo: q.tipo, espera: q.espera, resposta, quadro, achados, erro });
    console.log(`${id} | ${achados.length ? 'FALHA ' + achados.join(', ') : 'ok'} | ${q.pergunta}`);
  }
}
await navegador.close();
mkdirSync('relatorios', { recursive: true });
writeFileSync('relatorios/avaliacao-respostas.json', JSON.stringify({ data: new Date().toISOString(), resultados }, null, 2));
const falhas = resultados.filter((r) => r.achados.length);
const md = ['# Avaliação das respostas', '', `Rodada em ${new Date().toISOString().slice(0, 10)}. ${resultados.length} perguntas, ${falhas.length} com achado do detector.`, '',
  'Notas de voz, método, concisão e segurança (0 a 4) são do dono: preencher a coluna "Nota".', '',
  '| Personagem | Tipo | Pergunta | Detector | Nota |', '|---|---|---|---|---|',
  ...resultados.map((r) => `| ${r.personagem} | ${r.tipo} | ${r.pergunta} | ${r.achados.join(', ') || 'ok'} | |`), '',
  ...resultados.flatMap((r) => [`## ${r.personagem}: ${r.pergunta}`, `Espera: ${r.espera}`, '', `Resposta: ${r.resposta}`, r.quadro ? `\nQuadro:\n${r.quadro}` : '', ''])].join('\n');
writeFileSync('relatorios/avaliacao-respostas.md', md);
process.exit(falhas.length ? 1 : 0);
