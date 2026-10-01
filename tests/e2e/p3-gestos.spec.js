// P3: máquina de estados dos gestos no app de verdade. O Gemini é simulado (page.route);
// a voz é o Kokoro local (precisa do servidor em 127.0.0.1:8880, como no M5).
// Verifica: aceno ao carregar, marca inválida do LLM ignorada e registrada, marca válida tocada
// só na fronteira de uma sentença (nunca começa no meio), e capturas dos quadros-chave.
import { test, expect } from '@playwright/test';

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
  // Desde o P4 o aceno é da sessão, não do carregamento.
  await page.evaluate(() => window.__prof3d.iniciarSessao('operador'));
  return erros;
}

test('P3.1: aceno ao carregar, com subida, aceno e descida capturados', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await abrir(page);
  await expect.poll(() => page.evaluate(() => window.__prof3d.registroGestos.map((r) => r.msg).join('|'))).toContain('tocou "aceno" (fluxo)');
  for (const [rotulo, t] of [['1-sobe', 0.6], ['2-acena', 1.6], ['3-desce', 3.6]]) {
    await page.waitForFunction((x) => (window.__prof3d.avatar.tempoGesto ?? 99) >= x, t, { timeout: 10_000 });
    await page.screenshot({ path: `relatorios/p3-aceno-${rotulo}-paisagem.png` });
  }
  await expect.poll(() => page.evaluate(() => window.__prof3d.avatar.gestoAtivo), { timeout: 10_000 }).toBe(null);
});

test('P3.2: marca inválida do LLM é ignorada; válida espera a fronteira da sentença', async ({ page }) => {
  // Intervalo mínimo curto só para o teste não esperar 8 s depois do aceno inicial.
  const erros = await abrir(page, { intervalo_gestos: '1' });
  await expect.poll(() => page.evaluate(() => window.__prof3d.registroGestos.length), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__prof3d.avatar.gestoAtivo), { timeout: 15_000 }).toBe(null);
  await page.waitForTimeout(1100);
  await expect.poll(() => page.evaluate(() => window.__prof3d.avatar.gestoAtivo), { timeout: 15_000 }).toBe(null);
  await page.route('**/generativelanguage.googleapis.com/**', (rota) => rota.fulfill({
    status: 200, contentType: 'text/event-stream',
    body: sseDe(['[gesto:dancar-funk] O céu é azul porque a luz do sol se espalha no ar. ', 'A cor azul se espalha mais que as outras. [ges', 'to:comemora] Muito bem, ótima curiosidade!']),
  }));
  await page.fill('#text', 'Por que o céu é azul?');
  await page.click('#form button[type=submit]');
  await expect.poll(() => page.evaluate(() => window.__prof3d.registroGestos.map((r) => r.msg).join('|')), { timeout: 60_000 }).toMatch(/tocou "(sinal-paz|giro)" \(llm\)/);
  const r = await page.evaluate(() => ({ gestos: window.__prof3d.registroGestos, voz: window.__prof3d.voz.registro, balao: document.getElementById('answer').textContent }));
  expect(r.gestos.some((g) => /ignorado: "dancar-funk" \(llm\) não existe/.test(g.msg))).toBe(true);
  expect(r.balao).not.toMatch(/gesto/);

  // O gesto começou numa fronteira: não está dentro de nenhuma sentença que já tocava.
  const inicio = r.gestos.find((g) => /tocou "(sinal-paz|giro)"/.test(g.msg)).t;
  const frases = r.voz.filter((e) => e.tipo === 'toca-inicio').map((e) => ({ i: e.i, ini: e.t, fim: (r.voz.find((f) => f.tipo === 'toca-fim' && f.i === e.i && f.turno === e.turno) || {}).t ?? Infinity }));
  for (const f of frases) expect(inicio > f.ini + 30 && inicio < f.fim - 30, `gesto em ${inicio} dentro da frase ${f.i} (${f.ini}..${f.fim})`).toBe(false);
  await page.screenshot({ path: 'relatorios/p3-comemora-paisagem.png' });
  expect(erros).toEqual([]);
});

test('P3.3: modo calmo bloqueia gesto amplo; retrato com aceno', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 1280 });
  await abrir(page, { modo_calmo: 'sim' });
  await page.waitForFunction(() => (window.__prof3d.avatar.tempoGesto ?? 0) >= 1.6, null, { timeout: 15_000 });
  await page.screenshot({ path: 'relatorios/p3-aceno-2-acena-retrato.png' });
  const r = await page.evaluate(() => window.__prof3d.pedirGesto('comemora', 'operador'));
  expect(r).toEqual({ ignorado: 'sem-clipe' });
  // Espera o aceno e a fala do cumprimento acabarem (durante a fala o gesto esperaria a fronteira).
  await page.waitForFunction(() => window.__prof3d.avatar.gestoAtivo === null && !window.__prof3d.voz.falando, null, { timeout: 30_000 });
  // Sem modo calmo, o operador consegue (passa por cima do intervalo).
  await page.evaluate(() => localStorage.setItem('prof3d_modo_calmo', 'nao'));
  expect(await page.evaluate(() => !!window.__prof3d.pedirGesto('comemora', 'operador').clipe)).toBe(true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'relatorios/p3-comemora-retrato.png' });
});
