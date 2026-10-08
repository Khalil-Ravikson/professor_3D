// Abre o visualizador (Photo Booth) no Chromium e guarda capturas em paisagem e retrato, no modo do operador e no modo público.
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/verificar-photobooth.mjs [luma|matematico]
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:8771';
const pers = process.argv[2] || 'luma';
const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const erros = [];
for (const [nome, vp] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 430, height: 900 }]]) {
  for (const publico of [false, true]) {
    const page = await nav.newPage({ viewport: vp });
    page.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|XNNPACK/.test(m.text())) erros.push(`${nome}: ${m.text().slice(0, 160)}`); });
    await page.addInitScript(([p, pub]) => { localStorage.clear(); localStorage.setItem('prof3d_personagem', p); localStorage.setItem('prof3d_motor', 'webspeech'); if (pub) localStorage.setItem('prof3d_totem', 'sim'); }, [pers, publico]);
    await page.goto(BASE + '/?debug');
    await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
    await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
    const t0 = Date.now();
    await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
    await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe && window.__prof3d.visualizador.estado.tocando, null, { timeout: 60000 });
    const gerou = Date.now() - t0;
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({ minis: document.querySelectorAll('.pb-mini[data-id]').length, comImagem: document.querySelectorAll('.pb-mini img').length, abas: [...document.querySelectorAll('.pb-abas [role=tab]')].filter((b) => !b.hidden).map((b) => b.textContent), selecionada: (document.querySelector('.pb-mini[aria-pressed=true]') || {}).dataset && document.querySelector('.pb-mini[aria-pressed=true]').dataset.id, foto: [document.getElementById('pbFoto').disabled, document.getElementById('pbVideo').disabled] }));
    console.log(`${nome}/${publico ? 'publico' : 'operador'}: entrada em ${(gerou / 1000).toFixed(1)} s |`, JSON.stringify(info));
    await page.screenshot({ path: `relatorios/photobooth-tela-${pers}-${nome}-${publico ? 'publico' : 'operador'}.png` });
    if (!publico && nome === 'paisagem') {
      for (const aba of ['expressoes', 'rastreamento', 'fundo']) { await page.click(`#pbAba_${aba}`); await page.waitForTimeout(250); await page.screenshot({ path: `relatorios/photobooth-tela-${pers}-aba-${aba}.png` }); }
    }
    await page.close();
  }
}
console.log('erros:', erros.length ? erros.slice(0, 5) : 'nenhum');
await nav.close();
