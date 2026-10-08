// P1: galeria de animações no painel. Toca um clipe no personagem, pausa, troca velocidade,
// desliga e confere que a escolha persiste depois de recarregar. Capturas em paisagem e retrato.
import { test, expect } from '@playwright/test';

async function abrirLuma(page) {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(() => { if (!sessionStorage.getItem('limpo')) { localStorage.clear(); sessionStorage.setItem('limpo', '1'); } localStorage.setItem('prof3d_personagem', 'luma'); });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__prof3d && window.__prof3d.avatar && window.__prof3d.catalogo, null, { timeout: 60_000 });
  return erros;
}

for (const [nome, viewport] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 720, height: 1280 }]]) {
  test(`P1 galeria (${nome})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const erros = await abrirLuma(page);
    await page.click('#gear');
    await page.click('#abas button[data-aba="animacoes"]'); // a galeria mora na aba Animações do console
    const itens = page.locator('#galeria li');
    // Modo infantil ligado por padrão: o clipe "dedo-arma" (Shoot) fica fora.
    await expect(itens).toHaveCount(17); // 10 do catálogo antigo menos o dedo-arma, mais os 8 clipes do Overte
    await expect(page.locator('#galeria li[data-id="dedo-arma"]')).toHaveCount(0);

    const giro = page.locator('#galeria li[data-id="giro"]');
    await giro.locator('.g-tocar').click();
    await expect(page.locator('#settings')).toHaveClass(/espiando/);
    await page.waitForFunction(() => window.__prof3d.avatar.previa.tempo > 2.5, null, { timeout: 15_000 });
    await page.screenshot({ path: `relatorios/p1-galeria-${nome}.png` });

    await giro.locator('.g-pausar').click();
    const t1 = await page.evaluate(() => window.__prof3d.avatar.previa.tempo);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__prof3d.avatar.previa.tempo)).toBe(t1);
    await giro.locator('.g-pausar').click();
    await giro.locator('.g-vel').selectOption('1.5');

    // Desliga o "sinal-paz" e confere que sobrevive ao recarregar.
    await page.locator('#galeria li[data-id="sinal-paz"] .g-ligado').uncheck();
    await page.click('#closeSettings');
    await expect.poll(() => page.evaluate(() => window.__prof3d.avatar.previa.ativa)).toBe(false);
    await page.reload();
    await page.waitForFunction(() => window.__prof3d && window.__prof3d.avatar && window.__prof3d.catalogo, null, { timeout: 60_000 });
    await page.click('#gear');
    await expect(page.locator('#galeria li[data-id="sinal-paz"]')).toHaveAttribute('data-status', 'desligado');

    // Modo infantil desligado: aparecem os 8.
    await page.uncheck('#modoInfantil');
    await expect(itens).toHaveCount(18);
    expect(erros).toEqual([]);
  });
}
