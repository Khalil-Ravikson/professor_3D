// P5: fluxo de sessão completo, em paisagem e retrato. Gemini simulado; voz pelo Kokoro local.
// Captura cada etapa e confere o texto visível: sem travessão, sem abertura genérica, um próximo passo por etapa.
import { test, expect } from '@playwright/test';

const sseDe = (pedacos) => pedacos.map((p) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: p }] } }] })}\r\n\r\n`).join('');
const PROIBIDO = [/—/, /Claro!/i, /Ótima pergunta/i, /Com certeza!/i, /no mundo de hoje/i];

async function textoVisivel(page) {
  return page.evaluate(() => document.getElementById('app').innerText);
}
async function botoesVisiveis(page) {
  return page.evaluate(() => [...document.querySelectorAll('#painel button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim() || b.getAttribute('aria-label')));
}

for (const [nome, viewport] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 720, height: 1280 }]]) {
  test(`P5 fluxo (${nome})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('prof3d_gemini_key', 'chave-falsa');
      localStorage.setItem('prof3d_personagem', 'luma');
    });
    await page.route('**/generativelanguage.googleapis.com/**', (rota) => rota.fulfill({
      status: 200, contentType: 'text/event-stream', body: sseDe(['O céu é azul porque a luz azul se espalha mais no ar.']),
    }));
    await page.goto('/?debug');
    await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && window.__prof3d.voz.frasesProntas >= 4, null, { timeout: 60_000 });
    const textos = [];

    // 1. Atração: um botão no painel ("Começar"), sem conversa, sem microfone.
    await expect(page.locator('#passo')).toBeVisible();
    await expect(page.locator('#passoTitulo')).toHaveText('Luma está aqui');
    expect(await botoesVisiveis(page)).toEqual(['Começar']);
    textos.push(await textoVisivel(page));
    await page.screenshot({ path: `relatorios/p5-1-atracao-${nome}.png` });

    // 2. Cumprimento: some o convite, aparece a fala.
    await page.click('#passoAcao');
    await expect(page.locator('#answer')).toContainText('Que bom te ver');
    expect(await page.evaluate(() => window.__prof3d.etapa)).toBe('cumprimento');
    await page.waitForTimeout(1200);
    textos.push(await textoVisivel(page));
    await page.screenshot({ path: `relatorios/p5-2-cumprimento-${nome}.png` });

    // 3. Consentimento: depois da fala. Um botão principal e uma alternativa.
    await expect(page.locator('#passoTitulo')).toHaveText('Posso ouvir você?', { timeout: 20_000 });
    expect(await botoesVisiveis(page)).toEqual(['Usar o microfone', 'Prefiro escrever']);
    await expect(page.locator('#passoNota')).toHaveText('A câmera está desligada.');
    textos.push(await textoVisivel(page));
    await page.screenshot({ path: `relatorios/p5-3-consentimento-${nome}.png` });

    // 4. Conversa: com microfone.
    await page.click('#passoAcao');
    await expect(page.locator('#mic')).toBeVisible();
    await expect(page.locator('#mic')).toBeFocused();
    await page.fill('#text', 'Por que o céu é azul?');
    await page.click('#form button[type=submit]');
    await page.waitForFunction(() => (window.__prof3d.historicos.get('luma') || []).length === 2, null, { timeout: 30_000 });
    await page.waitForFunction(() => window.__prof3d.estado === 'idle', null, { timeout: 30_000 });
    textos.push(await textoVisivel(page));
    await page.screenshot({ path: `relatorios/p5-4-conversa-${nome}.png` });

    // 5. Despedida e limpeza: volta à atração, conversa apagada, microfone esquecido.
    await page.evaluate(() => window.__prof3d.encerrarSessao('operador'));
    await expect(page.locator('#answer')).toContainText('Tchau');
    expect(await page.evaluate(() => window.__prof3d.etapa)).toBe('despedida');
    await page.waitForTimeout(1200);
    textos.push(await textoVisivel(page));
    await page.screenshot({ path: `relatorios/p5-5-despedida-${nome}.png` });
    await expect.poll(() => page.evaluate(() => window.__prof3d.etapa), { timeout: 20_000 }).toBe('atracao');
    expect(await page.evaluate(() => window.__prof3d.historicos.get('luma').length)).toBe(0);
    await expect(page.locator('#answer')).toHaveText('');
    await page.screenshot({ path: `relatorios/p5-6-limpeza-${nome}.png` });

    // 6. Segunda pessoa escolhe escrever: microfone some, aparece a opção de mudar de ideia.
    await page.click('#passoAcao');
    await expect(page.locator('#passoTitulo')).toHaveText('Posso ouvir você?', { timeout: 20_000 });
    await page.click('#passoAlt');
    await expect(page.locator('#mic')).toBeHidden();
    await expect(page.locator('#text')).toBeFocused();
    await expect(page.locator('#usarVoz')).toBeVisible();

    for (const t of textos) for (const re of PROIBIDO) expect(t, `texto proibido ${re}`).not.toMatch(re);
    expect(erros).toEqual([]);
  });
}
