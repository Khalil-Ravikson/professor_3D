// Base da Luma (UEMA e CTIC) em português infantil, perguntas livres e o bug da trava "Agora só consigo responder o que já está pronto".
// Prepara a base com o E5 de verdade (baixa 118 MB na primeira vez e fica no cache do contexto) e conta as chamadas ao Gemini simulado.
import { test, expect } from '@playwright/test';

const sse = (t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\r\n\r\n`;

test('Luma e Teo: UEMA só com a base, perguntas livres seguem para o Gemini, e a trava econômica explica o porquê', async ({ page }) => {
  test.setTimeout(420_000);
  let chamadas = 0;
  const avisos = []; // avisos ao operador (o app os repete no console); a mesma mensagem seguida não se repete
  page.on('console', (m) => { if (m.text().startsWith('[evento]')) avisos.push(m.text()); });
  const corpos = [];
  await page.route('**/generativelanguage.googleapis.com/**', (r) => { chamadas++; corpos.push(r.request().postData() || ''); return r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('Claro! Vou explicar de um jeito simples.') }); });
  const abrir = async (personagem, extra = {}) => {
    await page.addInitScript(([p, x]) => { if (localStorage.getItem('prof3d_p16')) return; localStorage.setItem('prof3d_p16', '1'); localStorage.setItem('prof3d_gemini_key', 'chave-de-teste'); localStorage.setItem('prof3d_personagem', p); localStorage.setItem('prof3d_motor', 'webspeech'); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, [personagem, extra]);
    await page.goto('/?debug');
    await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
    await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  };
  const perguntar = async (q) => { await page.fill('#text', q); await page.click('#form button[type=submit]'); };

  // 1. Sem a base preparada, pergunta da UEMA NÃO vai ao Gemini (ele inventaria) e o operador é avisado.
  await abrir('luma');
  await perguntar('O que é a UEMA?');
  await expect(page.locator('#answer')).toContainText('Não encontrei isso na minha base', { timeout: 20_000 });
  expect(chamadas).toBe(0);

  // 2. Prepara a base de verdade e confere que as 9 documentos entraram.
  const estado = await page.evaluate(async () => { await window.__prof3d.rag.verificar('luma'); await window.__prof3d.rag.preparar('luma'); return window.__prof3d.rag.estado('luma'); });
  expect(estado.documentos).toBe(9);
  expect(estado.pendentes).toEqual([]);

  // 3. Base pronta e Gemini disponível: pergunta da UEMA vai ao Gemini COM o trecho da base; pergunta de todo dia vai sem base.
  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  await page.evaluate(() => window.__prof3d.rag.verificar('luma'));
  await perguntar('Lema e significado da UEMA');
  await expect(page.locator('#answer')).toContainText('Claro!', { timeout: 20_000 });
  expect(chamadas).toBe(1);
  expect(corpos[0]).toContain('Produzir saberes para transformar vidas'); // o trecho da base foi para o prompt
  await expect(page.locator('#fontes')).toBeVisible();
  await page.waitForFunction(() => window.__prof3d.estado === 'idle' || window.__prof3d.estado === 'listening', null, { timeout: 30_000 });
  await perguntar('Por que o céu é azul?');
  await expect(page.locator('#answer')).toContainText('Claro!', { timeout: 20_000 });
  expect(chamadas).toBe(2);
  expect(corpos[1]).not.toContain('Produzir saberes para transformar vidas'); // pergunta geral: sem trecho da UEMA

  // 4. Modo econômico (a trava): a resposta da base sai sem Gemini, e a pergunta geral explica o motivo ao operador em vez de só repetir a frase.
  await page.evaluate(() => localStorage.setItem('prof3d_modo_economico', 'sim'));
  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  await page.evaluate(() => window.__prof3d.rag.verificar('luma'));
  const antes = chamadas;
  await perguntar('O que é o PAES UEMA?');
  await expect(page.locator('#answer')).toContainText('teste de entrada', { timeout: 20_000 });
  await expect(page.locator('#answer')).not.toContainText('Resposta-base');
  await expect(page.locator('#answer')).not.toContainText('Pergunta:');
  expect(chamadas).toBe(antes);

  // 4b. Pergunta de todo dia na trava: a criança vê a frase gentil e o operador recebe o MOTIVO (modo ligado à mão ou teto atingido).
  console.log('estado antes da pergunta geral:', await page.evaluate(() => window.__prof3d.estado));
  await page.evaluate(() => window.__prof3d.voz.parar()); // o resumo de resposta ainda pode estar falando
  await page.waitForFunction(() => !['thinking', 'talking'].includes(window.__prof3d.estado), null, { timeout: 30_000 }).catch(() => console.log('estado preso em', 'talking'));
  await perguntar('Me conta uma história de dragão');
  await expect(page.locator('#answer')).toContainText('Agora só consigo responder o que já está pronto', { timeout: 20_000 });
  expect(avisos.join(' ')).toContain('Modo econômico ativo (ligado à mão na aba Orçamento)');
  expect(chamadas).toBe(antes);

  // 5. Teo não responde sobre a UEMA: manda para a Luma, sem Gemini.
  await page.evaluate(() => localStorage.setItem('prof3d_personagem', 'matematico'));
  await page.evaluate(() => localStorage.removeItem('prof3d_modo_economico'));
  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  const antesTeo = chamadas;
  await perguntar('Para que serve o SigUema?');
  await expect(page.locator('#answer')).toContainText('Essa pergunta é para a Luma', { timeout: 20_000 });
  expect(chamadas).toBe(antesTeo);
  await page.waitForFunction(() => window.__prof3d.estado === 'idle' || window.__prof3d.estado === 'listening', null, { timeout: 30_000 });
  await perguntar('Quanto é 7 vezes 8?');
  await expect(page.locator('#answer')).toContainText('Claro!', { timeout: 20_000 });
  expect(chamadas).toBe(antesTeo + 1); // matemática do Teo continua indo ao Gemini
});
