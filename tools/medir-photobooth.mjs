// Desempenho do Photo Booth (prompt 07, V7): tempo de abertura sem e com as miniaturas em cache, FPS do render dentro do visualizador e vazamento
// ao abrir e fechar 20 vezes (geometrias, texturas, nós do DOM, ouvintes e heap). Roda no Chromium com render por software: os FPS valem para
// comparar situações, não em valor absoluto.
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/medir-photobooth.mjs [luma|matematico]
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:8771';
const pers = process.argv[2] || 'luma';
const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 720 } });
const erros = [];

async function abrir(limpar) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(([p, limpar]) => { if (limpar) { try { localStorage.clear(); } catch { /* sem armazenamento: segue */ } } localStorage.setItem('prof3d_personagem', p); localStorage.setItem('prof3d_motor', 'webspeech'); }, [pers, limpar]);
  await page.goto(BASE + '/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  return page;
}
async function apagarCache(page) {
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]); r.then((l) => Promise.all(l.map((d) => new Promise((ok) => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = () => ok(); })))).then(res); }));
}
async function entrar(page) {
  const t0 = Date.now();
  await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.tocando, null, { timeout: 90000 });
  return Date.now() - t0;
}

// 1. Abertura sem cache e com cache.
let page = await abrir(true);
await apagarCache(page);
await page.reload();
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
const frio = await entrar(page);
const minisFrio = await page.evaluate(() => document.querySelectorAll('.pb-mini[data-id] img').length);
await page.evaluate(() => window.__prof3d.visualizador.sair());
const quente = await entrar(page);
console.log(`abertura sem miniaturas em cache: ${(frio / 1000).toFixed(1)} s (${minisFrio} miniaturas); com cache: ${(quente / 1000).toFixed(1)} s`);

// 2. FPS dentro do visualizador.
await page.waitForTimeout(1500);
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(+(n / 4).toFixed(1)); }; requestAnimationFrame(f); }));
console.log(`FPS do render no Photo Booth: ${fps} (software)`);

// 3. Vazamento: 20 aberturas e fechamentos.
const foto = () => page.evaluate(() => {
  const info = window.__prof3d.cena.renderer.info;
  return { geometrias: info.memory.geometries, texturas: info.memory.textures, nos: document.getElementsByTagName('*').length, pb: document.querySelectorAll('.pb').length, heapMb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
});
await page.evaluate(() => window.__prof3d.visualizador.sair());
await page.waitForTimeout(800);
const antes = await foto();
for (let i = 0; i < 20; i++) { await entrar(page); await page.evaluate(() => window.__prof3d.visualizador.sair()); }
await page.waitForTimeout(800);
const depois = await foto();
console.log('antes :', JSON.stringify(antes));
console.log('depois:', JSON.stringify(depois));
const cresceu = depois.geometrias - antes.geometrias || depois.texturas - antes.texturas || depois.pb - antes.pb || depois.nos - antes.nos;
console.log(cresceu ? 'VAZAMENTO: algum contador cresceu' : 'sem vazamento: geometrias, texturas, nós do DOM e telas do Photo Booth voltam ao mesmo valor');
console.log('erros:', erros.length ? erros.slice(0, 3) : 'nenhum');
await nav.close();
