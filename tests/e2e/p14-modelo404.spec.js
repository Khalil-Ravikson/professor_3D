// 404 do Gemini = o id do modelo não existe para esta chave (por exemplo um modelo antigo guardado na engrenagem).
// O reserva responde; se também falhar, a tela diz que o modelo não foi achado, sem expor caminho nem chave.
import { test, expect } from '@playwright/test';

const sse = (texto) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] })}\r\n\r\n`;
const abrir = async (page) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('prof3d_gemini_key', 'chave-de-teste');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    localStorage.setItem('prof3d_modelo', 'gemini-modelo-que-nao-existe');
  });
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
};

test('modelo principal com 404: o modelo reserva responde e a tela não mostra erro', async ({ page }) => {
  const modelos = [];
  await page.route('**/generativelanguage.googleapis.com/**', (r) => {
    const m = (r.request().url().match(/models\/([^:]+):/) || [])[1];
    modelos.push(m);
    if (m === 'gemini-modelo-que-nao-existe') return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'models/x is not found' } }) });
    return r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('O céu é azul por causa da luz.') });
  });
  await abrir(page);
  await page.fill('#text', 'Por que o céu é azul?');
  await page.click('#form button[type=submit]');
  await expect(page.locator('#answer')).toContainText('luz', { timeout: 20_000 });
  expect(modelos).toEqual(['gemini-modelo-que-nao-existe', 'gemini-2.5-flash-lite']);
});

test('404 no principal e no reserva: mensagem pede para trocar o nome do modelo', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await abrir(page);
  await page.fill('#text', 'Por que o céu é azul?');
  await page.click('#form button[type=submit]');
  await expect(page.locator('#answer')).toContainText('trocar o nome do modelo', { timeout: 20_000 });
  await expect(page.locator('#answer')).toContainText('gemini-modelo-que-nao-existe');
});
