// Bug: a sessão fechava no meio da conversa (o personagem dava tchau) porque só ENVIAR uma pergunta zerava o relógio.
import { test, expect } from '@playwright/test';

async function abrir(page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('prof3d_teste_inat')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_inat', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    localStorage.setItem('prof3d_inatividade_s', '3');
    window.__sr = { starts: 0, ultimo: null };
    class FakeSR {
      constructor() { window.__sr.ultimo = this; }
      start() { window.__sr.starts++; }
      stop() { setTimeout(() => this.onend && this.onend(), 0); }
      abort() { setTimeout(() => this.onend && this.onend(), 0); }
    }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  });
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('sim'));
}
const etapa = (page) => page.evaluate(() => window.__prof3d.etapa);

test('digitar devagar por mais tempo que o limite não fecha a conversa; parar de mexer fecha', async ({ page }) => {
  await abrir(page);
  await page.focus('#text');
  // 8 s de digitação a cada 1 s, com limite de 3 s: antes da correção a sessão fechava aos 3 s.
  for (let i = 0; i < 8; i++) { await page.keyboard.type('a'); await page.waitForTimeout(1000); }
  expect(await etapa(page)).toBe('conversa');
  await page.waitForFunction(() => window.__prof3d.etapa === 'despedida', null, { timeout: 10_000 });
});

test('girar a câmera e mexer na barra também contam como presença', async ({ page }) => {
  await abrir(page);
  await page.waitForFunction(() => window.__prof3d.cena.orbitaAtiva, null, { timeout: 15_000 });
  await page.keyboard.type('x');
  const c = await page.locator('#stage canvas').boundingBox();
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2 + 60, c.y + c.height / 2, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(900);
  }
  expect(await etapa(page)).toBe('conversa');
});

test('microfone aberto não deixa a sessão fechar; ao parar, o relógio recomeça', async ({ page }) => {
  await abrir(page);
  await page.click('#mic');
  expect(await page.evaluate(() => window.__sr.starts)).toBe(1);
  await page.waitForTimeout(6500); // mais que o dobro do limite, sem tocar em nada
  expect(await etapa(page)).toBe('conversa');
  await page.click('#mic'); // parar
  await page.waitForFunction(() => window.__prof3d.etapa === 'despedida', null, { timeout: 12_000 });
});
