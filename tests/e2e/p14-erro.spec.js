// Erro de resposta: vira o sinal "Problema" e a criança tem um botão para tentar de novo, sem digitar a pergunta outra vez.
import { test, expect } from '@playwright/test';

const sse = (texto) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] })}\r\n\r\n`;

test('429 do Gemini: sinal Problema, botão Tentar de novo reenvia a mesma pergunta e limpa o erro', async ({ page }) => {
  let chamadas = 0;
  const perguntas = [];
  await page.route('**/generativelanguage.googleapis.com/**', (r) => {
    chamadas++;
    perguntas.push(r.request().postData() || '');
    if (chamadas === 1) return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'cota' } }) });
    return r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('O céu é azul por causa da luz.') });
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('prof3d_gemini_key', 'chave-de-teste');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    localStorage.setItem('prof3d_modelo_reserva', ''); // sem modelo reserva: o erro do principal aparece (a cadeia de modelos é testada em p14-modelo404)
  });
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  await expect(page.locator('#tentarDeNovo')).toBeHidden();

  await page.fill('#text', 'Por que o céu é azul?');
  await page.click('#form button[type=submit]');
  await expect(page.locator('#estadoChip')).toHaveText('Problema');
  await expect(page.locator('#tentarDeNovo')).toBeVisible();
  await expect(page.locator('#tentarDeNovo')).toHaveText('Tentar de novo');
  expect((await page.locator('#tentarDeNovo').boundingBox()).height).toBeGreaterThanOrEqual(56);

  await page.click('#tentarDeNovo');
  await expect(page.locator('#answer')).toContainText('luz', { timeout: 20_000 });
  await expect(page.locator('#tentarDeNovo')).toBeHidden();
  expect(chamadas).toBe(2);
  expect(perguntas[1]).toContain('Por que o céu é azul?'); // a mesma pergunta, sem digitar de novo
});

test('encerrar a conversa esconde o botão e esquece a pergunta que falhou', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('prof3d_gemini_key', 'chave-de-teste');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    localStorage.setItem('prof3d_modelo_reserva', ''); // sem modelo reserva: o erro do principal aparece (a cadeia de modelos é testada em p14-modelo404)
  });
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  await page.fill('#text', 'pergunta que falha');
  await page.click('#form button[type=submit]');
  await expect(page.locator('#tentarDeNovo')).toBeVisible();
  await page.click('#maisBtn');
  await page.getByRole('menuitem', { name: 'Escolher outro personagem' }).click();
  await page.waitForFunction(() => window.__prof3d.etapa === 'selecao');
  await expect(page.locator('#tentarDeNovo')).toBeHidden();
});
