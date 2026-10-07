// Fase 5, I4: barra de comando da conversa ("+", Guiada/Livre, sinal de estado e legenda).
import { test, expect } from '@playwright/test';

async function abrir(page, viewport = { width: 1280, height: 720 }, extra = {}) {
  await page.setViewportSize(viewport);
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript((ex) => {
    if (localStorage.getItem('prof3d_teste_barra')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_barra', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    for (const [k, v] of Object.entries(ex)) localStorage.setItem('prof3d_' + k, v);
  }, extra);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  return erros;
}

for (const [nome, vp] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 540, height: 960 }]]) {
  test(`I4 barra de comando (${nome}): partes, rótulos e alvos de 56 px`, async ({ page }) => {
    const erros = await abrir(page, vp);
    await expect(page.locator('#barra')).toBeVisible();
    await expect(page.locator('#maisBtn')).toHaveAttribute('aria-label', 'Mais opções');
    await expect(page.locator('#modoGuiada')).toHaveText('Guiada');
    await expect(page.locator('#modoLivre')).toHaveText('Livre');
    await expect(page.locator('#modoLivre')).toHaveAttribute('aria-pressed', 'true');
    for (const id of ['maisBtn', 'modoGuiada', 'modoLivre']) {
      const b = await page.locator('#' + id).boundingBox();
      expect(b.height, id).toBeGreaterThanOrEqual(48); // o grupo Guiada/Livre tem 4 px de respiro de cada lado
    }
    expect((await page.locator('#maisBtn').boundingBox()).width).toBeGreaterThanOrEqual(56);
    // Nenhum texto da barra tem travessão.
    const textos = await page.locator('#barra, #legenda').evaluateAll((els) => els.map((e) => e.textContent).join(' '));
    expect(textos).not.toMatch(/[—–]/);
    await page.screenshot({ path: `relatorios/p14-barra-${nome}.png` });
    expect(erros).toEqual([]);
  });
}

test('I4 menu "+": abre, navega por seta, fecha com Esc e devolve o foco', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('#maisMenu')).toBeHidden();
  await page.click('#maisBtn');
  await expect(page.locator('#maisMenu')).toBeVisible();
  await expect(page.locator('#maisBtn')).toHaveAttribute('aria-expanded', 'true');
  const itens = page.locator('#maisMenu button');
  await expect(itens).toHaveCount(3);
  await expect(itens.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(itens.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(itens.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#maisMenu')).toBeHidden();
  await expect(page.locator('#maisBtn')).toBeFocused();
  // Toque fora também fecha.
  await page.click('#maisBtn');
  await expect(page.locator('#maisMenu')).toBeVisible();
  await page.mouse.click(40, 40);
  await expect(page.locator('#maisMenu')).toBeHidden();
  for (const b of await itens.all()) { await page.click('#maisBtn'); expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(56); await page.keyboard.press('Escape'); }
});

test('I4 Guiada: só as perguntas sugeridas; Livre devolve campo e microfone; a escolha sobrevive ao recarregar', async ({ page }) => {
  await abrir(page, undefined, {});
  await page.evaluate(() => window.__prof3d.irParaConversa('sim'));
  await expect(page.locator('#text')).toBeVisible();
  await page.click('#modoGuiada');
  await expect(page.locator('#modoGuiada')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#text')).toBeHidden();
  await expect(page.locator('#mic')).toBeHidden();
  expect(await page.locator('#chips .chip').count()).toBeGreaterThan(0);
  await expect(page.locator('#chips .chip').first()).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('sim'));
  await expect(page.locator('#modoGuiada')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#text')).toBeHidden();
  await page.click('#modoLivre');
  await expect(page.locator('#text')).toBeVisible();
  await expect(page.locator('#mic')).toBeVisible();
});

test('I4 sinal de estado e legenda: palavra além da cor, e a legenda abre pelo menu', async ({ page }) => {
  await abrir(page);
  const chip = page.locator('#estadoChip');
  await expect(chip).toHaveText('Pronto');
  for (const [estado, palavra] of [['listening', 'Ouvindo'], ['thinking', 'Pensando'], ['speaking', 'Falando'], ['idle', 'Pronto']]) {
    await page.evaluate((s) => window.__prof3d.definirEstado(s), estado);
    await expect(chip).toHaveText(palavra);
    await expect(chip).toHaveAttribute('data-estado', estado);
  }
  await expect(page.locator('#legenda')).toBeHidden();
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'O que cada sinal quer dizer' }).click();
  await expect(page.locator('#legenda')).toBeVisible();
  await expect(page.locator('#legendaLista li')).toHaveCount(5);
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'O que cada sinal quer dizer' }).click();
  await expect(page.locator('#legenda')).toBeHidden();
});

test('I4 menu: "Ver o personagem de perto" abre o visualizador e "Terminar a conversa" chega à despedida', async ({ page }) => {
  await abrir(page);
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'Ver o personagem de perto' }).click();
  expect(await page.evaluate(() => window.__prof3d.visualizador.ativo)).toBe(true);
  await page.evaluate(() => window.__prof3d.visualizador.sair());
  await page.evaluate(() => window.__prof3d.iniciarSessao && window.__prof3d.iniciarSessao());
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'Terminar a conversa' }).click();
  await page.waitForFunction(() => window.__prof3d.etapa === 'despedida', null, { timeout: 15_000 });
});
