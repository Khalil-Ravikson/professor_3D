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
    await expect(page.locator('#modoGuiada')).toHaveText('Sugestões');
    await expect(page.locator('#modoLivre')).toHaveText('Perguntar');
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
  await expect(itens).toHaveCount(5);
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

// ---- Câmera livre desde o início, e sair do personagem sem sobras ----
const camera = (page) => page.evaluate(() => { const c = window.__prof3d.cena; return { p: c.camera.position.toArray(), orbita: c.orbitaAtiva }; });
const longe = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function arrastar(page, dx, dy) {
  const c = await page.locator('#stage canvas').boundingBox();
  const x = c.x + c.width / 2, y = c.y + c.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(300);
}

for (const personagem of ['luma', 'matematico']) {
  test(`I4 câmera livre na conversa (${personagem}): liga sozinha, sem salto, gira, e o duplo clique centraliza`, async ({ page }) => {
    await abrir(page, undefined, { personagem });
    await page.waitForFunction(() => window.__prof3d.cena.orbitaAtiva, null, { timeout: 15_000 });
    const padrao = await page.evaluate(() => window.__prof3d.cena.alvoPadrao().posicao.toArray());
    const antes = await camera(page);
    expect(longe(antes.p, padrao), 'ligar a câmera livre não pode mover a câmera').toBeLessThan(0.02);
    await arrastar(page, 160, 40);
    const girou = await camera(page);
    expect(longe(girou.p, antes.p), 'arrastar gira a câmera').toBeGreaterThan(0.1);
    const c = await page.locator('#stage canvas').boundingBox();
    await page.mouse.dblclick(c.x + c.width / 2, c.y + c.height / 2);
    await page.waitForTimeout(900);
    expect(longe((await camera(page)).p, padrao), 'o duplo clique volta ao enquadramento').toBeLessThan(0.02);
  });
}

test('I4 câmera livre: desliga ao sair da conversa e o menu centraliza', async ({ page }) => {
  await abrir(page);
  await page.waitForFunction(() => window.__prof3d.cena.orbitaAtiva, null, { timeout: 15_000 });
  await arrastar(page, -150, 30);
  const padrao = await page.evaluate(() => window.__prof3d.cena.alvoPadrao().posicao.toArray());
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'Centralizar o personagem' }).click();
  await page.waitForTimeout(900);
  expect(longe((await camera(page)).p, padrao)).toBeLessThan(0.02);
  await page.evaluate(() => window.__prof3d.definirEtapa && 0);
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'Escolher outro personagem' }).click();
  await page.waitForFunction(() => window.__prof3d.etapa === 'selecao');
  expect((await camera(page)).orbita, 'na seleção a câmera livre fica desligada').toBe(false);
});

test('bug: fechar a conversa com o microfone aberto não deixa uma pergunta nascer depois', async ({ page }) => {
  await page.addInitScript(() => {
    window.__sr = { starts: 0, ultimo: null };
    class FakeSR {
      constructor() { window.__sr.ultimo = this; }
      start() { window.__sr.starts++; }
      stop() { setTimeout(() => this.onend && this.onend(), 0); }
      abort() { setTimeout(() => this.onend && this.onend(), 0); }
    }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  });
  await abrir(page);
  await page.evaluate(() => window.__prof3d.irParaConversa('sim'));
  await page.click('#mic');
  expect(await page.evaluate(() => window.__sr.starts)).toBe(1);
  await page.evaluate(() => window.__sr.ultimo.onresult({ results: [[{ transcript: 'qual a capital do Maranhão' }]] }));
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'Terminar a conversa' }).click();
  await page.waitForFunction(() => window.__prof3d.etapa === 'despedida', null, { timeout: 10_000 });
  // O navegador entrega o fim do reconhecimento depois do fechamento.
  await page.evaluate(() => window.__sr.ultimo.onend());
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__prof3d.etapa), 'não pode voltar para a conversa').toBe('despedida');
  expect(await page.evaluate(() => window.__sr.starts), 'não pode religar o microfone').toBe(1);
  await expect(page.locator('#estadoChip')).not.toHaveText('Ouvindo');
});

test('sair do personagem: "Escolher outro personagem" limpa a conversa e volta à escolha', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => { window.__prof3d.historicos.get(window.__prof3d.personagem.id).push({ role: 'user', parts: [{ text: 'oi' }] }); });
  await page.fill('#text', 'rascunho');
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'Escolher outro personagem' }).click();
  await page.waitForFunction(() => window.__prof3d.etapa === 'selecao');
  await expect(page.locator('#selecao')).toBeVisible();
  expect(await page.evaluate(() => [...window.__prof3d.historicos.values()].every((h) => h.length === 0))).toBe(true);
  await expect(page.locator('#text')).toHaveValue('');
  await expect(page.locator('#maisMenu')).toBeHidden();
});

for (const [nome, vp] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 540, height: 960 }], ['totem', { width: 1080, height: 1920 }]]) {
  test(`I4 o menu "+" cabe inteiro na tela (${nome}), sem ser cortado`, async ({ page }) => {
    await abrir(page, vp);
    await page.click('#maisBtn');
    const m = await page.locator('#maisMenu').boundingBox();
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.y).toBeGreaterThanOrEqual(0);
    expect(m.x + m.width).toBeLessThanOrEqual(vp.width);
    expect(m.y + m.height).toBeLessThanOrEqual(vp.height);
    for (const b of await page.locator('#maisMenu button').all()) await expect(b).toBeInViewport({ ratio: 1 });
  });
}
