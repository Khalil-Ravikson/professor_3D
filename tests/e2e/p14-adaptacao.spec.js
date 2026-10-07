// I7 (adapt, animate, audit): alvos de 56 px na conversa, escala do totem em pé, movimento com alternativa real, leitor de tela.
import { test, expect } from '@playwright/test';

async function abrir(page, viewport, extra = {}) {
  await page.setViewportSize(viewport);
  await page.addInitScript((ex) => {
    localStorage.clear();
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    for (const [k, v] of Object.entries(ex)) localStorage.setItem('prof3d_' + k, v);
  }, extra);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('sim'));
}

const pequenos = (page, minimo) => page.evaluate((m) => [...document.querySelectorAll('#painel button, #painel input, #painel summary')]
  .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })
  .filter((e) => { const r = e.getBoundingClientRect(); return r.width < m || r.height < m; })
  .map((e) => `${e.id || e.className} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`), minimo);

for (const [nome, vp] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 540, height: 960 }], ['celular', { width: 360, height: 640 }], ['totem', { width: 1080, height: 1920 }]]) {
  test(`conversa (${nome}): tudo que a criança toca tem 56 px ou mais, sem rolagem lateral`, async ({ page }) => {
    await abrir(page, vp);
    expect(await pequenos(page, 56)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('totem em pé: letra e alvos maiores que no celular', async ({ page }) => {
  await abrir(page, { width: 1080, height: 1920 });
  const t = await page.evaluate(() => ({ chip: document.querySelector('.chip').getBoundingClientRect().height, fonte: parseFloat(getComputedStyle(document.querySelector('.chip')).fontSize), modo: document.getElementById('modoLivre').getBoundingClientRect().height }));
  expect(t.chip).toBeGreaterThanOrEqual(72);
  expect(t.fonte).toBeGreaterThanOrEqual(19);
  expect(t.modo).toBeGreaterThanOrEqual(72);
});

test('reduzir movimento: sem deslocamento nem pulso, mas a cor e a opacidade ainda avisam a mudança', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrir(page, { width: 1280, height: 720 });
  await page.click('#maisBtn');
  const m = await page.evaluate(() => {
    const menu = getComputedStyle(document.getElementById('maisMenu'));
    const chip = getComputedStyle(document.querySelector('.chip'));
    return { animacao: menu.animationName, propriedades: chip.transitionProperty, duracao: chip.transitionDuration };
  });
  expect(m.animacao).toBe('none');
  expect(m.propriedades).toContain('background-color');
  expect(m.propriedades).not.toContain('transform');
  expect(parseFloat(m.duracao)).toBeGreaterThan(0);
});

test('sem reduzir movimento, o menu entra com animação curta', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 });
  await page.click('#maisBtn');
  const a = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('maisMenu')); return { nome: s.animationName, dur: parseFloat(s.animationDuration) }; });
  expect(a.nome).toBe('surge');
  expect(a.dur).toBeLessThanOrEqual(0.3);
});

test('leitor de tela: o estado é anunciado uma vez (status), e o sinal visual não repete', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 });
  await expect(page.locator('#status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#estadoChip')).toHaveAttribute('aria-hidden', 'true');
});

test('diagnóstico mostra a voz e o motor do personagem atual', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 });
  await page.click('#gear');
  await expect(page.locator('#settings')).toBeVisible();
  await expect.poll(() => page.locator('#diag').innerText()).toContain('Voz do personagem');
  await expect(page.locator('#diag')).toContainText('Luma: pf_dora');
});
