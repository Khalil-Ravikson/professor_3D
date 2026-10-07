// P9, acessibilidade: alvos de toque, legenda sempre visível, região aria-live,
// foco por teclado e modo calmo. Em retrato e paisagem.
import { test, expect } from '@playwright/test';

const ALVO = 44; // --alvo no CSS

async function abrir(page, viewport) {
  await page.setViewportSize(viewport);
  // A marca evita apagar, no reload, o que o teste acabou de guardar.
  await page.addInitScript(() => {
    if (localStorage.getItem('prof3d_teste_p9')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_p9', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    localStorage.setItem('prof3d_gemini_key', 'chave-falsa');
  });
  await page.goto('/?debug');
  await page.waitForFunction(
    () => !!(window.__prof3d && window.__prof3d.avatar) && !/Preparando/.test(document.getElementById('status').textContent),
    null, { timeout: 90_000 },
  );
}

for (const [nome, viewport] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 720, height: 1280 }]]) {
  test(`P9 alvos de toque na tela do público (${nome})`, async ({ page }) => {
    await abrir(page, viewport);
    await page.evaluate(() => window.__prof3d.irParaConversa('sim'));

    const pequenos = await page.evaluate((alvo) => {
      const fora = [];
      const alvos = document.querySelectorAll('#app button, #app input, #app select, #app a[href]');
      for (const el of alvos) {
        if (el.offsetParent === null || el.disabled) continue;
        if (el.closest('dialog')) continue; // o painel do operador não é tela de público
        const r = el.getBoundingClientRect();
        if (r.width < alvo || r.height < alvo) {
          fora.push(`${el.id || el.className || el.tagName}: ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return fora;
    }, ALVO);
    expect(pequenos, `alvos menores que ${ALVO}px: ${pequenos.join(', ')}`).toEqual([]);
  });
}

test('P9 legenda do que o personagem fala fica visível e é anunciada', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 });

  // A bolha da legenda é uma região viva para o leitor de tela.
  const bolha = page.locator('.bubble');
  await expect(bolha).toHaveAttribute('aria-live', 'polite');

  // A vitrine e a escolha são mudas: não há fala para legendar. Na vitrine o painel inteiro some.
  expect(await page.evaluate(() => window.__prof3d.etapa)).toBe('atracao');
  await expect(bolha).toBeHidden();

  // No cumprimento, a fala do aceno aparece escrita.
  await page.click('#vitrineCta');
  await page.click('#selConversar'); // vitrine, seleção, cumprimento
  await expect(page.locator('#answer')).not.toBeEmpty();
  await expect(bolha).toBeVisible();
  await page.screenshot({ path: 'relatorios/p9-legenda.png' });
});

test('P9 foco por teclado alcança os controles e o anel aparece', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 });
  await page.evaluate(() => window.__prof3d.irParaConversa('sim'));

  const ordem = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const estilo = getComputedStyle(el, ':focus-visible');
      return { id: el.id, tag: el.tagName, contorno: estilo.outlineWidth };
    });
    if (foco && foco.id) ordem.push(foco.id);
  }
  // Os controles que o público usa estão no caminho do Tab.
  for (const id of ['volMudo', 'volSlider', 'mic', 'text']) {
    expect(ordem, `${id} não recebeu foco; ordem: ${ordem.join(' > ')}`).toContain(id);
  }

  // O anel de foco não foi desligado em lugar nenhum.
  await page.focus('#mic');
  const anel = await page.evaluate(() => {
    const e = getComputedStyle(document.getElementById('mic'));
    return { largura: e.outlineWidth, estilo: e.outlineStyle };
  });
  expect(anel.estilo).not.toBe('none');
  expect(parseFloat(anel.largura)).toBeGreaterThanOrEqual(2);
});

test('P9 modo calmo recusa gesto amplo e sobrevive ao recarregar', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));

  // Antes: um gesto de intensidade maior que 1 é aceito.
  const amplo = await page.evaluate(() => {
    const c = window.__prof3d.catalogo;
    const g = Object.entries(c.estados || {}).find(([nome, v]) => {
      if (nome.startsWith('_') || !v) return false;
      const clipes = Array.isArray(v) ? v : [v];
      return clipes.every((id) => ((c.clipes.find((x) => x.id === id) || {}).intensidade || 0) > 1);
    });
    return g ? g[0] : null;
  });
  test.skip(!amplo, 'o catálogo não tem gesto de intensidade maior que 1');

  await page.click('#gear');
  await page.click('#abas button[data-aba="animacoes"]'); // o modo calmo mora na aba Animações do console do operador
  await page.check('#modoCalmo');
  await page.click('#closeSettings');

  const antes = await page.evaluate(() => window.__prof3d.registroGestos.length);
  await page.evaluate((g) => window.__prof3d.pedirGesto(g, 'teste'), amplo);
  const registro = await page.evaluate((n) => window.__prof3d.registroGestos.slice(n), antes);
  expect(registro.map((r) => r.msg).join(' | ')).toContain('modo calmo');

  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar), null, { timeout: 90_000 });
  expect(await page.isChecked('#modoCalmo')).toBe(true);
});
