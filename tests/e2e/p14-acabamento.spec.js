// I7: acabamento. Erro do avatar sem texto técnico para a criança; sinal de erro visível; contraste da barra no Teo e na Luma.
import { test, expect } from '@playwright/test';

const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

test('avatar ausente: a criança lê um aviso com saída; o caminho do arquivo só aparece no bloco do adulto', async ({ page }) => {
  await page.route('**/assets/avatars/*.vrm', (r) => r.abort());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_motor', 'webspeech'); });
  await page.goto('/?debug');
  await expect(page.locator('#erroAvatar')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#erroTitulo')).toHaveText('Não consegui chamar este personagem.');
  await expect(page.locator('#erroAjuda')).toHaveText('Chame um adulto para ajudar.');
  const visivel = await page.locator('#erroAvatar').evaluate((el) => el.innerText);
  expect(visivel).not.toMatch(/assets\/|\.vrm/);
  await page.locator('#erroResumo').click();
  await expect(page.locator('#erroTecnico')).toContainText('.vrm');
  expect((await page.locator('#erroResumo').boundingBox()).height).toBeGreaterThanOrEqual(44);
});

for (const [id, nome] of [['luma', 'Luma'], ['matematico', 'Teo']]) {
  test(`barra e sinais com contraste legível (${nome}), inclusive o sinal de erro`, async ({ page }) => {
    await page.addInitScript((pid) => { localStorage.clear(); localStorage.setItem('prof3d_personagem', pid); localStorage.setItem('prof3d_motor', 'webspeech'); }, id);
    await page.goto('/?debug');
    await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
    await page.evaluate(() => window.__prof3d.irParaConversa('sim'));
    for (const estado of ['idle', 'listening', 'thinking', 'speaking', 'error']) {
      await page.evaluate((s) => window.__prof3d.definirEstado(s), estado);
      const r = await page.evaluate(() => {
        const chip = document.getElementById('estadoChip');
        const cs = getComputedStyle(chip), pt = getComputedStyle(chip, '::before');
        return { texto: cs.color, fundo: cs.backgroundColor, ponto: pt.backgroundColor, anel: (pt.boxShadow.match(/rgba?\([^)]*\)/) || [''])[0] };
      });
      expect(razao(r.texto, r.fundo), `${nome} texto do sinal ${estado}`).toBeGreaterThanOrEqual(4.5);
      // Bolinha com contraste próprio ou, quando a cor da paleta fica perto do fundo, o anel claro que a contorna.
      const sinal = Math.max(razao(r.ponto, r.fundo), r.anel ? razao(r.anel, r.fundo) : 0);
      expect(sinal, `${nome} bolinha do sinal ${estado}`).toBeGreaterThanOrEqual(3);
    }
    await page.evaluate(() => window.__prof3d.definirEstado('idle'));
    for (const sel of ['#modoGuiada', '#modoLivre', '#maisBtn', '.chip', '#status']) {
      const r = await page.locator(sel).first().evaluate((e) => {
        const cs = getComputedStyle(e); let n = e, f = 'rgba(0, 0, 0, 0)';
        while (n && f === 'rgba(0, 0, 0, 0)') { f = getComputedStyle(n).backgroundColor; n = n.parentElement; }
        return { cor: cs.color, fundo: f };
      });
      expect(razao(r.cor, r.fundo), `${nome} ${sel}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
