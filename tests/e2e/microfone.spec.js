// Microfone manual: o navegador encerrando o reconhecimento sozinho (pausa ou silêncio) não pode cortar a fala.
// O SpeechRecognition é simulado; o microfone real fica no roteiro manual.
import { test, expect } from '@playwright/test';

test('microfone: só o botão encerra; o fim automático do navegador religa e guarda o texto', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('prof3d_gemini_key', 'chave-de-teste');
    window.__sr = { starts: 0, stops: 0, ultimo: null };
    class FakeSR {
      constructor() { window.__sr.ultimo = this; }
      start() { window.__sr.starts++; }
      stop() { window.__sr.stops++; setTimeout(() => this.onend && this.onend(), 0); }
      abort() { setTimeout(() => this.onend && this.onend(), 0); }
    }
    window.SpeechRecognition = FakeSR;
    window.webkitSpeechRecognition = FakeSR;
  });
  // Nenhuma pergunta real: a resposta final é interceptada.
  await page.route('**/generativelanguage.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }));
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar), null, { timeout: 60_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa());

  await page.click('#mic');
  expect(await page.evaluate(() => window.__sr.starts)).toBe(1);

  // O navegador encerra sozinho depois de uma pausa: o app volta a ouvir, sem tratar como fim.
  await page.evaluate(() => { const s = window.__sr.ultimo; s.onresult({ results: [[{ transcript: 'qual a capital' }]] }); s.onend(); });
  expect(await page.evaluate(() => window.__sr.starts)).toBe(2);
  await page.evaluate(() => window.__sr.ultimo.onerror({ error: 'no-speech' }));
  await page.evaluate(() => window.__sr.ultimo.onend());
  expect(await page.evaluate(() => window.__sr.starts)).toBe(3);
  await expect(page.locator('#heard')).toContainText('qual a capital');

  // Só o clique no botão para.
  await page.click('#mic');
  expect(await page.evaluate(() => window.__sr.stops)).toBe(1);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__sr.starts)).toBe(3);
});
