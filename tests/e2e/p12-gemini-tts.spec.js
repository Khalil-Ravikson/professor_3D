// Gemini TTS como motor de voz selecionável. A API é SIMULADA (page.route): nenhuma chamada paga sai daqui.
// Confere o pedido enviado, o áudio tocando, a telemetria, o teto diário e a reserva para o Kokoro.
import { test, expect } from '@playwright/test';

// WAV de 0,6 s (24 kHz, mono, 16 bits) com um tom, em base64: o bastante para o decodeAudioData aceitar.
function wavBase64(seg = 0.6) {
  const taxa = 24000, n = Math.round(seg * taxa), dados = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) dados.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 330 * i) / taxa) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dados.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(taxa, 24);
  h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dados.length, 40);
  return Buffer.concat([h, dados]).toString('base64');
}

const RESPOSTA = (seg = 0.6) => JSON.stringify({
  id: 'x', status: 'completed', model: 'gemini-3.8-flash-lite-tts',
  usage: { total_input_tokens: 30, total_output_tokens: Math.round(seg * 25), output_tokens_by_modality: [{ modality: 'audio', tokens: Math.round(seg * 25) }] },
  steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wavBase64(seg) }] }],
});

async function abrir(page, extra = {}) {
  await page.setViewportSize({ width: 1280, height: 720 });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript((e) => {
    if (localStorage.getItem('prof3d_teste_gt')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_gt', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_gemini_key', 'chave-falsa-de-teste');
    for (const [k, v] of Object.entries(e)) localStorage.setItem('prof3d_' + k, v);
  }, extra);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  return erros;
}

const falar = (page, texto) => page.evaluate((t) => window.__prof3d.voz.falarTexto(t, window.__prof3d.personagem.voz), texto);
const fim = (page, antes) => page.waitForFunction((n) => window.__prof3d.voz.registro.slice(n).some((e) => e.tipo === 'turno-fim'), antes, { timeout: 30_000 });

test('Gemini TTS: o motor aparece na lista, o pedido segue a documentação e a telemetria é registrada', async ({ page }) => {
  const pedidos = [];
  await page.route('https://generativelanguage.googleapis.com/v1beta/interactions', async (rota) => {
    pedidos.push({ chave: rota.request().headers()['x-goog-api-key'], corpo: rota.request().postDataJSON() });
    await rota.fulfill({ status: 200, contentType: 'application/json', body: RESPOSTA() });
  });
  const erros = await abrir(page, { motor: 'gemini', gt_voz: 'Puck', gt_estilo: 'fale devagar', gt_modelo: 'gemini-3.8-flash-lite-tts' });

  // O seletor oferece o Gemini.
  await page.click('#gear');
  expect(await page.$$eval('#motorSel option', (o) => o.map((x) => x.value))).toContain('gemini');
  await expect(page.locator('#gtModelo')).toHaveValue('gemini-3.8-flash-lite-tts');
  await expect(page.locator('#gtVoz')).toHaveValue('Puck');
  await page.click('#closeSettings');

  const antes = await page.evaluate(() => window.__prof3d.voz.registro.length);
  await falar(page, 'Oi! Eu sou a Luma.');
  await fim(page, antes);

  expect(pedidos.length).toBeGreaterThanOrEqual(1);
  // Voz paga não pré-sintetiza ao carregar: o único pedido é o da fala que pedimos.
  expect(pedidos.length, 'só a fala pedida pode ir ao Gemini').toBeLessThanOrEqual(2);
  const p = pedidos.find((x) => /Luma/.test(JSON.stringify(x.corpo))) || pedidos[0];
  expect(p.chave).toBe('chave-falsa-de-teste');
  expect(p.corpo.model).toBe('gemini-3.8-flash-lite-tts');
  expect(p.corpo.input[0].type).toBe('user_input');
  expect(p.corpo.input[0].content[0].text.length).toBeGreaterThan(2);
  expect(p.corpo.input[0].content[0].annotations).toEqual([{ type: 'speech_metadata', style: 'fale devagar' }]);
  expect(p.corpo.response_format).toEqual({ type: 'audio' });
  expect(p.corpo.generation_config.speech_config).toEqual([{ voice: 'Puck' }]);

  // Tocou o áudio recebido, sem cair para outro motor.
  const reg = await page.evaluate(() => window.__prof3d.voz.registro.slice(0).map((e) => `${e.tipo}:${e.motor || ''}`));
  expect(reg.some((e) => e.startsWith('sintese-inicio:gemini'))).toBe(true);
  expect(reg.some((e) => e.startsWith('sintese-erro'))).toBe(false);
  expect(reg.some((e) => e.startsWith('toca-inicio'))).toBe(true);

  // Telemetria: uso do dia, caracteres, custo e latência.
  const uso = await page.evaluate(() => window.__prof3d.usoGemini);
  expect(uso.chamadas).toBeGreaterThanOrEqual(1);
  expect(uso.chars).toBeGreaterThan(10);
  expect(uso.usd).toBeGreaterThan(0);
  expect(uso.latencias.length).toBe(uso.chamadas);

  // E o painel mostra: diagnóstico e contador do bloco Gemini TTS.
  await page.click('#gear');
  await expect(page.locator('#gtUso')).toContainText('falas');
  await expect.poll(() => page.locator('#diag').innerText()).toContain('Voz Gemini hoje');
  expect(await page.locator('#diag').innerText()).toMatch(/Voz Gemini hoje\s+\d+ falas?/);
  await page.screenshot({ path: 'relatorios/p12-gemini-tts-painel.png' });
  expect(erros).toEqual([]);
});

test('Gemini TTS: o selo mostra a voz, e sem chave cai para outra voz com aviso', async ({ page }) => {
  let chamadas = 0;
  await page.route('https://generativelanguage.googleapis.com/v1beta/interactions', (rota) => { chamadas++; return rota.fulfill({ status: 200, body: RESPOSTA() }); });
  await abrir(page, { motor: 'gemini', gemini_key: '' });
  await falar(page, 'Teste sem chave.');
  await page.waitForTimeout(1500);
  expect(chamadas, 'sem chave não pode chamar o Gemini').toBe(0);
  const selo = await page.locator('#seloVoz').innerText();
  expect(selo).not.toContain('Gemini');
  await expect(page.locator('#seloVoz')).toHaveAttribute('data-alerta', 'sim');
  await page.click('#gear');
  await expect(page.locator('#statusVoz')).toContainText('Falta a chave do Gemini');
});

test('Gemini TTS: o teto diário de caracteres desliga o motor e o app usa outra voz', async ({ page }) => {
  let chamadas = 0;
  await page.route('https://generativelanguage.googleapis.com/v1beta/interactions', (rota) => { chamadas++; return rota.fulfill({ status: 200, body: RESPOSTA() }); });
  await abrir(page, { motor: 'gemini', gt_teto: '20' });
  const antes = await page.evaluate(() => window.__prof3d.voz.registro.length);
  await falar(page, 'Esta frase passa de vinte caracteres com folga.'); // 46 caracteres: a primeira chamada estoura o teto
  await fim(page, antes);
  const depois = chamadas;
  expect(depois, 'a primeira fala pode ir ao Gemini: o teto só vale a partir do que já foi gasto').toBeGreaterThanOrEqual(1);
  expect((await page.evaluate(() => window.__prof3d.usoGemini)).chars).toBeGreaterThanOrEqual(20);

  // Daqui em diante o teto está estourado: nenhuma chamada nova ao Gemini.
  const antes2 = await page.evaluate(() => window.__prof3d.voz.registro.length);
  await falar(page, 'Mais uma frase.');
  await page.waitForFunction((n) => window.__prof3d.voz.registro.slice(n).some((e) => e.tipo === 'turno-fim' || e.tipo === 'sintese-erro'), antes2, { timeout: 30_000 });
  expect(chamadas, 'estourou o teto: não pode chamar de novo').toBe(depois);
  await page.click('#gear');
  await expect(page.locator('#statusVoz')).toContainText('teto de caracteres');
});

test('Gemini TTS: erro da API cai para outra voz sem travar a fala', async ({ page }) => {
  let chamadas = 0;
  await page.route('https://generativelanguage.googleapis.com/v1beta/interactions', (rota) => { chamadas++; return rota.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"message":"cota"}}' }); });
  const erros = await abrir(page, { motor: 'gemini' });
  const antes = await page.evaluate(() => window.__prof3d.voz.registro.length);
  await falar(page, 'Primeira frase. Segunda frase.');
  await fim(page, antes);
  const reg = await page.evaluate((n) => window.__prof3d.voz.registro.slice(n).map((e) => e.tipo), antes);
  expect(reg).toContain('sintese-erro');
  // Depois da falha o Gemini fica de lado: a segunda frase não repete a chamada que acabou de falhar.
  expect(chamadas).toBe(1);
  expect(await page.evaluate(() => window.__prof3d.voz.statusGemini.ok)).toBe(false);
  expect(erros).toEqual([]);
});
