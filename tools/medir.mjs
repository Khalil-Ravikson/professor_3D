// Medição de desempenho: FPS em repouso, tempo até a primeira fala e memória após 10 trocas.
// Uso: python serve.py 8771 (em outro terminal) e depois node tools/medir.mjs [rotulo]
// Gasta 3 perguntas da chave do Gemini (.env.local). Sem chave, pula a primeira fala.
// Saída: relatorios/desempenho-<rotulo>.json
import { chromium } from '@playwright/test';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8771';
const rotulo = process.argv[2] || 'medida';
const chave = (existsSync('.env.local') && (readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1] || '').trim();
const PERGUNTAS = ['Por que o céu é azul?', 'Quanto é 7 vezes 8?', 'Me ensine uma palavra em inglês'];

const args = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader'];
const navegador = await chromium.launch({ args: [...args, '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const page = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
const cdp = await page.context().newCDPSession(page);
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
await page.addInitScript((k) => {
  localStorage.clear();
  localStorage.setItem('prof3d_personagem', 'luma');
  if (k) localStorage.setItem('prof3d_gemini_key', k);
}, chave);

const t0 = Date.now();
await page.goto(BASE + '/?debug');
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar), null, { timeout: 90_000 });
const cargaInicialMs = Date.now() - t0;

async function fps(segundos = 5) {
  return page.evaluate((s) => new Promise((ok) => {
    let n = 0; const ini = performance.now();
    const passo = () => { n++; if (performance.now() - ini < s * 1000) requestAnimationFrame(passo); else ok(+(n / s).toFixed(1)); };
    requestAnimationFrame(passo);
  }), segundos);
}
async function memoria() {
  await cdp.send('HeapProfiler.collectGarbage');
  return page.evaluate(() => {
    const i = window.__prof3d.cena.renderer.info.memory;
    return { heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), geometrias: i.geometries, texturas: i.textures };
  });
}

await page.waitForTimeout(2000);
const fpsRepouso = await fps();
const memInicio = await memoria();

const primeiraFala = [];
if (chave) {
  // Desde o P5 o app abre na etapa de atração, com o campo de escrever escondido.
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  for (const q of PERGUNTAS) {
    await page.fill('#text', q);
    const ini = Date.now();
    await page.click('#form button[type=submit]');
    await page.waitForFunction(() => window.__prof3d.estado === 'speaking' || /chave|erro|Ops|não consegui/i.test(document.getElementById('answer').textContent), null, { timeout: 90_000 });
    primeiraFala.push(Date.now() - ini);
    await page.waitForFunction(() => window.__prof3d.estado !== 'speaking' && window.__prof3d.estado !== 'thinking', null, { timeout: 120_000 });
  }
}
const fpsFalando = null; // medido no P3, quando o estado talking tiver clipe

const ordem = ['matematico', 'luma', 'engenheiro', 'luma', 'cientista', 'luma', 'matematico', 'luma', 'engenheiro', 'luma'];
for (const id of ordem) {
  await page.evaluate((x) => window.__prof3d.trocarPersonagem(window.__prof3d.buscarPersonagem(x)), id);
  await page.waitForFunction((x) => window.__prof3d.personagem.id === x && !!window.__prof3d.avatar, id, { timeout: 90_000 });
}
await page.waitForTimeout(1500);
const memDepois10Trocas = await memoria();

const mediana = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
const r = {
  rotulo, data: new Date().toISOString(), viewport: '1280x720', gpu: process.platform === 'win32' ? 'd3d11' : 'swiftshader',
  cargaInicialMs, fpsRepouso, fpsFalando,
  primeiraFalaMs: primeiraFala, primeiraFalaMedianaMs: mediana(primeiraFala),
  memInicio, memDepois10Trocas, erros,
};
mkdirSync('relatorios', { recursive: true });
writeFileSync(`relatorios/desempenho-${rotulo}.json`, JSON.stringify(r, null, 2));
console.log(JSON.stringify(r, null, 2));
await navegador.close();
