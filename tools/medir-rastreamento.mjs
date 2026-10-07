// Mede o pipeline do rastreamento do corpo (prompt 7, V5) SEM webcam: alimenta o worker (MediaPipe local) com a imagem do próprio avatar
// renderizado e registra carga, tempo de inferência por quadro, pontos devolvidos e erros.
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/medir-rastreamento.mjs [lite|full] [--sem-maos]
// A imagem vem de uma captura do palco: nenhum dado de pessoa. Os números de latência e FPS são DESTA máquina, com GPU por software
// no Chromium sem tela; a medição com a webcam e a GPU reais é do dono (TESTES-MANUAIS.md).
import { chromium } from '@playwright/test';

const qual = process.argv[2] === 'full' ? 'pose_landmarker_full.task' : 'pose_landmarker_lite.task';
const semMaos = process.argv.includes('--sem-maos');
const BASE = process.env.BASE || 'http://localhost:8771';
const log = (...a) => console.log(...a);

const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 700, height: 1000 } });
const erros = [];
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 200)); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_personagem', 'luma'); localStorage.setItem('prof3d_motor', 'webspeech'); });
await page.goto(BASE + '/?debug');
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
await page.waitForTimeout(2500);
log('avatar pronto; capturando o palco');
const png = await page.locator('#stage').screenshot();

const r = await page.evaluate(async ({ b64, modelo, maos }) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
  const w = new Worker('/src/corpo/worker-corpo.js');
  const msg = (f, ms = 120000) => new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('sem resposta do worker em ' + ms / 1000 + ' s')), ms);
    w.onmessage = (e) => { clearTimeout(timer); res(e.data); };
    w.onerror = (e) => { clearTimeout(timer); rej(new Error('worker onerror: ' + e.message)); };
    f();
  });
  const base = location.origin + '/assets/vendor/mediapipe/';
  const t0 = performance.now();
  const pronto = await msg(() => w.postMessage({ tipo: 'iniciar', base, modelo, maos }));
  const carga = Math.round(performance.now() - t0);
  const saidas = [];
  for (let i = 0; i < 12; i++) {
    const b2 = await createImageBitmap(bmp);
    const ini = performance.now();
    const out = await msg(() => w.postMessage({ tipo: 'quadro', bitmap: b2, t: performance.now() }, [b2]));
    saidas.push({ tipo: out.tipo, ida_e_volta: Math.round(performance.now() - ini), inferencia: Math.round(out.ms || 0), pontos: out.pose ? out.pose.length : 0, maos: out.maos ? Object.entries(out.maos).map(([k, v]) => k + ':' + (v ? v.length : 0)) : null, erro: out.mensagem, ombros: out.pose ? [out.pose[11], out.pose[12]].map((p) => [p.x, p.y, p.z, p.visibility].map((x) => +x.toFixed(3))) : null });
  }
  w.postMessage({ tipo: 'fechar' });
  return { pronto, carga, saidas };
}, { b64: png.toString('base64'), modelo: qual, maos: !semMaos });

log('delegado:', r.pronto.delegado, '| carga dos modelos:', r.carga, 'ms');
const ok = r.saidas.filter((s) => s.tipo === 'resultado');
const med = (k) => { const v = ok.map((s) => s[k]).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
log(`quadros com resultado: ${ok.length} de ${r.saidas.length}; inferência mediana ${med('inferencia')} ms; ida e volta mediana ${med('ida_e_volta')} ms`);
log('primeiro resultado:', JSON.stringify(r.saidas[0]));
log('erros:', erros.length ? erros.slice(0, 4) : 'nenhum');
await nav.close();
