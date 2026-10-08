// O modo econômico (frase "Agora só consigo responder o que já está pronto") agora aparece na tela, com o motivo, e desliga com um toque quando foi à mão.
import { test, expect } from '@playwright/test';

const sse = (t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\r\n\r\n`;

async function abrir(page, extra) {
  await page.addInitScript((x) => {
    localStorage.clear();
    localStorage.setItem('prof3d_gemini_key', 'chave-de-teste'); localStorage.setItem('prof3d_personagem', 'luma'); localStorage.setItem('prof3d_motor', 'webspeech');
    for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
  }, extra);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
}

test('modo econômico à mão: o selo explica, a frase aparece, um toque desliga e o Gemini volta a responder', async ({ page }) => {
  let chamadas = 0;
  await page.route('**/generativelanguage.googleapis.com/**', (r) => { chamadas++; return r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('Oi! Eu sou a Luma.') }); });
  await abrir(page, { prof3d_modo_economico: 'sim' });
  await expect(page.locator('#seloEco')).toBeVisible();
  await expect(page.locator('#seloEco')).toContainText('ligado à mão');
  await page.fill('#text', 'oi'); await page.click('#form button[type=submit]');
  await expect(page.locator('#answer')).toContainText('Agora só consigo responder o que já está pronto', { timeout: 20_000 });
  expect(chamadas).toBe(0);
  await page.evaluate(() => window.__prof3d.voz.parar());
  await page.waitForTimeout(1500); // dá tempo de a fala parar e a pergunta seguinte ser aceita
  await page.click('#seloEco');
  await expect(page.locator('#seloEco')).toBeHidden();
  await page.fill('#text', 'oi'); await page.click('#form button[type=submit]');
  await expect(page.locator('#answer')).toContainText('Oi! Eu sou a Luma.', { timeout: 20_000 });
  expect(chamadas).toBe(1);
});

test('teto atingido: o selo mostra os valores e leva à aba Orçamento, onde dá para zerar o gasto', async ({ page }) => {
  await abrir(page, { prof3d_teto_reais: '5', prof3d_custo: JSON.stringify({ dia: new Date().toISOString().slice(0, 10), entrada: 0, saida: 0, pensamento: 0, respostas: 0, porModelo: {}, acumUsd: 2 }) });
  await expect(page.locator('#seloEco')).toBeVisible();
  await expect(page.locator('#seloEco')).toContainText('teto atingido');
  await page.click('#seloEco');
  await expect(page.locator('#orcEstado')).toContainText('LIGADO porque o gasto acumulado');
  await page.click('#orcZerar');
  await expect(page.locator('#orcEstado')).toContainText('Modo econômico desligado');
  await expect(page.locator('#seloEco')).toBeHidden();
});
