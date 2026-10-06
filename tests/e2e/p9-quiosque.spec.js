// P9: recuperação depois de perder o contexto WebGL de verdade, vigia do laço e
// painel de diagnóstico do operador.
import { test, expect } from '@playwright/test';

const sseDe = (pedacos, uso) => pedacos.map((p) => `data: ${JSON.stringify({
  candidates: [{ content: { parts: [{ text: p }] } }],
  ...(uso ? { usageMetadata: uso } : {}),
})}\r\n\r\n`).join('');

async function abrir(page) {
  await page.addInitScript(() => {
    localStorage.clear();
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

test('P9 perda de contexto WebGL de verdade: avisa, recupera e remonta o avatar', async ({ page }) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrir(page);

  const antes = await page.evaluate(() => ({
    quadros: window.__prof3d.cena.quadros,
    texturas: window.__prof3d.cena.renderer.info.memory.textures,
  }));
  expect(antes.texturas).toBeGreaterThan(0);

  // Derruba o contexto com a extensão do próprio WebGL, como a GPU faria.
  const derrubou = await page.evaluate(() => window.__prof3d.cena.perderContextoDeProposito());
  expect(derrubou).toBe(true);

  // O público vê um aviso curto, não uma tela congelada.
  await expect(page.locator('#avisoQuiosque')).toBeVisible();
  await expect(page.locator('#avisoTitulo')).toHaveText('Um instante');
  expect(await page.evaluate(() => window.__prof3d.cena.contextoPerdido)).toBe(true);
  await page.screenshot({ path: 'relatorios/p9-contexto-perdido.png' });

  // O navegador devolve o contexto e o app remonta o modelo sozinho.
  await page.waitForFunction(() => !window.__prof3d.cena.contextoPerdido, null, { timeout: 15_000 });
  await expect(page.locator('#avisoQuiosque')).toBeHidden();
  await page.waitForFunction(() => !!window.__prof3d.avatar, null, { timeout: 60_000 });
  await page.waitForFunction(
    () => document.getElementById('loading').hidden && window.__prof3d.cena.renderer.info.memory.textures > 0,
    null, { timeout: 60_000 },
  );

  // O laço voltou a desenhar.
  const quadrosDepois = await page.evaluate(() => window.__prof3d.cena.quadros);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__prof3d.cena.quadros)).toBeGreaterThan(quadrosDepois);
  await page.screenshot({ path: 'relatorios/p9-contexto-restaurado.png' });

  // A página não recarregou: o contador de quadros não voltou a zero por recarga.
  expect(await page.evaluate(() => window.__prof3d.vigia.armado)).toBe(true);
  expect(erros).toEqual([]);
});

test('P9 painel de diagnóstico mostra versão, FPS, serviços e gasto', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', (rota) => rota.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: sseDe(['O céu fica azul porque a luz azul se espalha mais no ar.'], {
      promptTokenCount: 2000, candidatesTokenCount: 200, thoughtsTokenCount: 50,
    }),
  }));
  await abrir(page);
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));

  // Uma pergunta: alimenta latência e gasto.
  await page.fill('#text', 'Por que o céu é azul?');
  await page.click('#form button[type=submit]');
  await expect(page.locator('#answer')).toContainText('luz azul');
  await page.waitForFunction(() => window.__prof3d.custo.resumo().respostas > 0, null, { timeout: 30_000 });

  const g = await page.evaluate(() => window.__prof3d.custo.resumo());
  expect(g.entrada).toBe(2000);
  expect(g.saida).toBe(200);
  expect(g.pensamento).toBe(50);

  await page.click('#gear');
  await expect(page.locator('#settings')).toBeVisible();
  const texto = () => page.locator('#diag').innerText();
  await expect.poll(texto).toContain('Versão');
  const t = await texto();
  expect(t).toContain('Quadros por segundo');
  expect(t).toContain('Memória');
  expect(t).toContain('Gemini');
  expect(t).toContain('Avatar');
  // Latência medida de verdade na pergunta acima.
  expect(t).not.toContain('sem medida ainda');
  await page.screenshot({ path: 'relatorios/p9-diagnostico.png' });

  // A versão não aparece para o público.
  await page.click('#closeSettings');
  const noPalco = await page.evaluate(() => document.getElementById('stage').innerText);
  expect(noPalco).not.toContain(await page.evaluate(() => window.__prof3d.VERSAO));
});

test('P9 vigia: laço parado recarrega a página uma vez', async ({ page }) => {
  await abrir(page);
  // Vigia de laboratório dentro da própria página: mesma regra, relógio de mentira.
  const eventos = await page.evaluate(async () => {
    const { criarVigia } = await import('/src/vigia.js');
    const saida = [];
    let relogio = 1e6;
    const v = criarVigia({
      ultimoQuadro: () => 1e6,
      limiteMs: 10_000,
      intervaloMs: 60_000,
      aoTravar: (i) => saida.push('travou ' + i.tentativa),
      aoDesistir: () => saida.push('desistiu'),
      recarregar: () => saida.push('recarregou'),
      agora: () => relogio,
    });
    v.iniciar();
    relogio += 6_000; v.checarAgora();
    relogio += 6_000; v.checarAgora();
    relogio += 6_000; v.checarAgora();
    v.parar();
    sessionStorage.removeItem('prof3d_recargas');
    return saida;
  });
  expect(eventos).toEqual(['travou 1', 'recarregou']);
});
