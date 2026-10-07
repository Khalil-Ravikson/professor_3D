// Verifica o rastreamento do corpo no Chromium SEM webcam (prompt 7, V5):
//  1) repete uma sessão SINTÉTICA de números (braço direito da pessoa subindo, tronco girando) e salva capturas antes e depois;
//  2) liga e desliga o rastreamento com a câmera FALSA do Chromium (padrão de teste, sem pessoa): estados, taxa de quadros, tracks paradas.
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/verificar-corpo.mjs
// Saída: relatorios/corpo-antes.png, relatorios/corpo-depois-espelho.png, relatorios/corpo-depois-direto.png e os números no terminal.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8771';
mkdirSync('relatorios', { recursive: true });
const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await nav.newContext({ viewport: { width: 760, height: 1000 }, permissions: ['camera'] });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|XNNPACK/.test(m.text())) erros.push(m.text().slice(0, 220)); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_personagem', 'luma'); localStorage.setItem('prof3d_motor', 'webspeech'); });
await page.goto(BASE + '/?debug');
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
await page.waitForTimeout(2500);
await page.locator('#stage').screenshot({ path: 'relatorios/corpo-antes.png' });

// 1) Sessão sintética: 60 quadros a 30 por segundo. Pessoa de frente, +x = direita da imagem, +y para baixo.
const sessao = (subir) => {
  const quadros = [];
  for (let i = 0; i < 60; i++) {
    const k = Math.min(1, i / 30); // 0 a 1 em 1 s, depois segura
    const pose = Array.from({ length: 33 }, () => [0, 0, 0, 1]);
    const set = (idx, x, y, z = 0) => { pose[idx] = [x, y, z, 1]; };
    set(11, 0.2, -0.5); set(12, -0.2, -0.5); set(23, 0.1, 0); set(24, -0.1, 0);
    set(13, 0.2, -0.2); set(15, 0.2, 0.05); set(19, 0.2, 0.12); set(17, 0.18, 0.1);
    // braço direito da pessoa (lado -x): sobe de baixo até a horizontal, aberto para o lado
    const a = k * (Math.PI / 2); // 0 = caído, 90 graus = horizontal
    const cx = -0.2 - 0.3 * Math.sin(a), cy = -0.5 + 0.3 * Math.cos(a);
    const px = -0.2 - 0.55 * Math.sin(a), py = -0.5 + 0.55 * Math.cos(a);
    set(14, cx, cy); set(16, px, py); set(20, px - 0.06 * Math.sin(a), py + 0.06 * Math.cos(a)); set(18, px - 0.04 * Math.sin(a), py - 0.02 + 0.04 * Math.cos(a));
    quadros.push({ t: Math.round(i * 33), pose });
  }
  return JSON.stringify({ formato: 'landmarks-numeros-v1', quadros });
};
for (const espelho of [true, false]) {
  await page.evaluate((e) => { const c = window.__prof3d.corpo; c.desligar(); c.configurar({ espelho: e }); }, espelho);
  // A sessão roda em laço: ao terminar, a confiança cai e o braço voltaria ao clipe. Medimos no meio de uma repetição, com o rastreamento ativo.
  await page.evaluate((txt) => { window.__laco = true; const roda = () => window.__prof3d.corpo.repetir(txt, { aoFim: () => { if (window.__laco) roda(); } }); roda(); }, sessao());
  await page.waitForTimeout(9000); // o render por software é lento: várias voltas até a suavização chegar ao alvo
  const osso = await page.evaluate(() => {
    const h = window.__prof3d.avatar.vrm.humanoid;
    const q = (n) => { const x = h.getNormalizedBoneNode(n).quaternion; return [x.x, x.y, x.z, x.w].map((v) => +v.toFixed(3)); };
    return { leftUpperArm: q('leftUpperArm'), rightUpperArm: q('rightUpperArm'), estado: window.__prof3d.corpo.estado };
  });
  console.log(`espelho=${espelho}:`, JSON.stringify(osso));
  await page.locator('#stage').screenshot({ path: `relatorios/corpo-depois-${espelho ? 'espelho' : 'direto'}.png` });
  await page.evaluate(() => { window.__laco = false; });
  await page.waitForTimeout(500);
}

// 2) Liga e desliga com a câmera falsa: sem pessoa no quadro, o estado deve ir a "perdeu" (ou ficar calibrando) e as tracks devem parar.
await page.evaluate(() => { const c = window.__prof3d.corpo; c.desligar(); });
const marcas = [];
const t0 = Date.now();
await page.evaluate(() => window.__prof3d.corpo.ligar({}));
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1500);
  marcas.push(await page.evaluate(() => { const c = window.__prof3d.corpo; return { estado: c.estado, fps: c.stats.fps, delegado: c.stats.delegado, tracks: c.tracksAtivas }; }));
}
console.log('ligado com a câmera falsa:', JSON.stringify(marcas.map((m) => `${m.estado}/${m.fps}fps/${m.delegado}/${m.tracks}`)), ((Date.now() - t0) / 1000).toFixed(1) + ' s');
await page.evaluate(() => window.__prof3d.corpo.desligar());
console.log('depois de desligar:', JSON.stringify(await page.evaluate(() => ({ estado: window.__prof3d.corpo.estado, tracks: window.__prof3d.corpo.tracksAtivas, ligado: window.__prof3d.corpo.ligado }))));
console.log('erros:', erros.length ? erros.slice(0, 5) : 'nenhum');
await nav.close();
