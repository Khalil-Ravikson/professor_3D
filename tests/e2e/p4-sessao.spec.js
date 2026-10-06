// P4: ciclo de sessão. Gemini simulado; voz pelo Kokoro local.
// Mede: gatilho -> início do aceno, e início do aceno -> início da fala (alvo ~300 ms).
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const sseDe = (pedacos) => pedacos.map((p) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: p }] } }] })}\r\n\r\n`).join('');

async function abrir(page, extra = {}) {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript((x) => {
    localStorage.clear();
    localStorage.setItem('prof3d_gemini_key', 'chave-falsa');
    localStorage.setItem('prof3d_personagem', 'luma');
    for (const [c, v] of Object.entries(x)) localStorage.setItem('prof3d_' + c, v);
  }, extra);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar && window.__prof3d.diretor), null, { timeout: 60_000 });
  return erros;
}

// Início da fala logo depois de um instante (ms de performance.now).
const inicioFalaDepois = (voz, t) => (voz.find((e) => e.tipo === 'toca-inicio' && e.t >= t) || {}).t;

test('P4: cumprimento por toque, conversa, despedida pelo operador; e despedida por inatividade', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const erros = await abrir(page);
  await page.route('**/generativelanguage.googleapis.com/**', (rota) => rota.fulfill({
    status: 200, contentType: 'text/event-stream', body: sseDe(['Sete vezes oito é cinquenta e seis.']),
  }));
  const relatorio = {};

  // 1. Atração: nada acontece sozinho.
  expect(await page.evaluate(() => window.__prof3d.sessaoAtiva)).toBe(false);
  await page.screenshot({ path: 'relatorios/p4-1-atracao.png' });

  // 2. Cumprimento por toque na tela (depois de as frases fixas estarem prontas, como num quiosque ligado).
  await page.waitForFunction(() => window.__prof3d.voz.frasesProntas >= 4, null, { timeout: 30_000 });
  await page.mouse.click(300, 400);
  expect(await page.evaluate(() => window.__prof3d.etapa)).toBe('selecao'); // fase 5: o toque chama a seleção
  await expect(page.locator('#selConversar')).toBeEnabled();
  await page.click('#selConversar');
  await expect.poll(() => page.evaluate(() => window.__prof3d.medidasSessao.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__prof3d.medidasSessao[0].gesto !== null)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__prof3d.voz.registro.some((e) => e.tipo === 'toca-inicio')), { timeout: 30_000 }).toBe(true);
  let r = await page.evaluate(() => ({ m: window.__prof3d.medidasSessao[0], voz: window.__prof3d.voz.registro, balao: document.getElementById('answer').textContent }));
  relatorio.cumprimento = { origem: r.m.origem, gatilhoAteGestoMs: Math.round(r.m.gesto - r.m.gatilho), gestoAteFalaMs: Math.round(inicioFalaDepois(r.voz, r.m.gesto) - r.m.gesto) };
  expect(r.m.origem).toBe('toque');
  expect(r.balao).toContain('Que bom te ver');
  expect(relatorio.cumprimento.gestoAteFalaMs).toBeGreaterThanOrEqual(280);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'relatorios/p4-2-cumprimento.png' });

  // 3. Conversa.
  await page.waitForFunction(() => window.__prof3d.estado === 'idle', null, { timeout: 30_000 });
  // P5: depois do cumprimento vem o consentimento; aqui a pessoa prefere escrever.
  await page.click('#passoAlt');
  await page.fill('#text', 'Quanto é 7 vezes 8?');
  await page.click('#form button[type=submit]');
  await page.waitForFunction(() => (window.__prof3d.historicos.get('luma') || []).length === 2, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__prof3d.estado === 'idle', null, { timeout: 30_000 });
  await page.screenshot({ path: 'relatorios/p4-3-conversa.png' });

  // 4. Despedida pelo operador: aceno, frase e histórico limpo.
  await page.click('#gear');
  await page.click('#opEncerrar');
  await expect.poll(() => page.evaluate(() => window.__prof3d.medidasSessao.length)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__prof3d.medidasSessao[1].gesto !== null)).toBe(true);
  r = await page.evaluate(() => ({ m: window.__prof3d.medidasSessao[1], hist: window.__prof3d.historicos.get('luma').length, ativa: window.__prof3d.sessaoAtiva, balao: document.getElementById('answer').textContent }));
  relatorio.despedidaOperador = { gatilhoAteGestoMs: Math.round(r.m.gesto - r.m.gatilho) };
  expect(r.hist).toBe(0);
  expect(r.ativa).toBe(false);
  await expect(page.locator('#answer')).toContainText('Tchau');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'relatorios/p4-4-despedida.png' });

  // 5. Despedida por inatividade (2 s só no teste; o padrão é 90 s).
  await page.waitForFunction(() => window.__prof3d.estado === 'idle' && window.__prof3d.avatar.gestoAtivo === null, null, { timeout: 30_000 });
  await page.evaluate(() => localStorage.setItem('prof3d_inatividade_s', '2'));
  await page.waitForTimeout(9000); // intervalo para o aceno de despedida não ser o anterior colado
  await page.evaluate(() => window.__prof3d.iniciarSessao('operador'));
  await page.waitForFunction(() => window.__prof3d.estado === 'idle' && window.__prof3d.avatar.gestoAtivo === null, null, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__prof3d.medidasSessao.map((m) => m.origem)), { timeout: 15_000 }).toContain('inatividade');
  relatorio.medidasSessao = await page.evaluate(() => window.__prof3d.medidasSessao.map((m) => ({ tipo: m.tipo, origem: m.origem, gatilhoAteGestoMs: m.gesto && Math.round(m.gesto - m.gatilho) })));
  mkdirSync('relatorios', { recursive: true });
  writeFileSync('relatorios/p4-tempos.json', JSON.stringify(relatorio, null, 2));
  console.log(JSON.stringify(relatorio, null, 2));
  expect(erros).toEqual([]);
});
