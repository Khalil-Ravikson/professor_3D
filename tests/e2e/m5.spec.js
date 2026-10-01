// M5: quadro, calcular() via function calling, ajustes por personagem e vozes do Edge.
// O Gemini é simulado (page.route); nenhuma chamada sai para a internet.
import { test, expect } from '@playwright/test';

const sse = (obj) => `data: ${JSON.stringify(obj)}\r\n\r\n`;
const textoSSE = (texto) => texto.match(/.{1,15}/gs).map((p) => sse({ candidates: [{ content: { role: 'model', parts: [{ text: p }] } }] })).join('');

const RESPOSTA_TEO = [
  'FALA: Primeiro tiro o sete dos dois lados.',
  'QUADRO: Dado: 3x + 7 = 25',
  'QUADRO: Pede: o valor de x',
  'QUADRO: Passo 1: 3x = 25 - 7 = 18',
  'QUADRO: Passo 2: x = 18 / 3 = 6',
  'QUADRO: Curiosidade: 42 é um número famoso',
  'FALA: Então x vale seis.',
  'QUADRO: Resposta: x = 6',
].join('\n');

async function abrir(page, armazenamento = {}) {
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await page.addInitScript((extra) => {
    localStorage.clear();
    localStorage.setItem('prof3d_gemini_key', 'chave-de-teste');
    for (const [c, v] of Object.entries(extra)) localStorage.setItem('prof3d_' + c, v);
  }, armazenamento);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar), null, { timeout: 60_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa());
  return erros;
}

// Simula o Gemini: 1ª chamada pede duas contas; depois de receber as respostas, devolve o texto.
async function simularGemini(page, { textoFinal = RESPOSTA_TEO } = {}) {
  const pedidos = [];
  await page.route('**/generativelanguage.googleapis.com/**', async (rota) => {
    const corpo = JSON.parse(rota.request().postData());
    pedidos.push(corpo);
    const ultimo = corpo.contents[corpo.contents.length - 1];
    const temResposta = ultimo.parts.some((p) => p.functionResponse);
    const body = !corpo.tools || temResposta
      ? textoSSE(textoFinal)
      : sse({ candidates: [{ content: { role: 'model', parts: [
        { functionCall: { name: 'calcular', args: { expressao: '25 - 7' } }, thoughtSignature: 'assinatura-teste' },
        { functionCall: { name: 'calcular', args: { expressao: '18 / 3' } } },
      ] } }] });
    await rota.fulfill({ status: 200, contentType: 'text/event-stream', body });
  });
  return pedidos;
}

async function perguntar(page, texto) {
  await page.fill('#text', texto);
  await page.click('#form button[type=submit]');
}

test('M5: Teo usa calcular, o quadro mostra só números conferidos e a fala vem separada', async ({ page }) => {
  const pedidos = await simularGemini(page);
  const erros = await abrir(page, { personagem: 'matematico' });
  await expect(page.locator('#quadro')).toBeVisible();
  await perguntar(page, 'Resolva 3x + 7 = 25');
  await expect(page.locator('.quadro-linhas li.resposta')).toContainText('x = 6', { timeout: 15_000 });

  // 2 rodadas: a segunda devolve as partes do modelo (com a assinatura) e os resultados do mathjs.
  expect(pedidos.length).toBe(2);
  expect(pedidos[0].tools[0].functionDeclarations[0].name).toBe('calcular');
  const [modelo, respostas] = pedidos[1].contents.slice(-2);
  expect(modelo.role).toBe('model');
  expect(modelo.parts[0].thoughtSignature).toBe('assinatura-teste');
  expect(respostas.role).toBe('user');
  expect(respostas.parts.map((p) => p.functionResponse.response.resultado)).toEqual(['18', '6']);

  const estado = await page.evaluate(() => window.__prof3d.quadro.estado);
  expect(estado.contas.map((c) => `${c.expressao} = ${c.resultado}`)).toEqual(['25 - 7 = 18', '18 / 3 = 6']);
  const porRotulo = Object.fromEntries(estado.linhas.map((l) => [l.texto.split(':')[0], l]));
  expect(porRotulo['Passo 2'].suspeitos).toBe(0);
  expect(porRotulo['Resposta'].suspeitos).toBe(0);
  expect(porRotulo['Curiosidade'].suspeitos, '42 não veio do enunciado nem da calculadora').toBe(1);
  await expect(page.locator('.quadro-linhas li', { hasText: 'Curiosidade' }).locator('.nao-conferido')).toHaveText('?');

  // O balão só tem a fala; nada de marcador nem de linha do quadro.
  const balao = await page.locator('#answer').textContent();
  expect(balao).toBe('Primeiro tiro o sete dos dois lados.\nEntão x vale seis.');
  expect(erros).toEqual([]);
});

test('M5: Luma não recebe ferramenta nem quadro', async ({ page }) => {
  const pedidos = await simularGemini(page, { textoFinal: 'Sete vezes oito é cinquenta e seis.' });
  await abrir(page, { personagem: 'luma' });
  await expect(page.locator('#quadro')).toBeHidden();
  await perguntar(page, 'Quanto é 7 vezes 8?');
  await expect(page.locator('#answer')).toHaveText('Sete vezes oito é cinquenta e seis.', { timeout: 15_000 });
  expect(pedidos.length).toBe(1);
  expect(pedidos[0].tools).toBeUndefined();
  expect(pedidos[0].generationConfig.temperature, 'temperatura padrão do modelo: não envia').toBeUndefined();
});

test('M5: ajustes do personagem (temperatura, limite, persona) chegam à requisição e restauram', async ({ page }) => {
  const pedidos = await simularGemini(page);
  await abrir(page, { personagem: 'matematico' });
  await page.click('#gear');
  await expect(page.locator('#ajPersonagem')).toHaveValue('matematico');
  await page.uncheck('#ajTempPadrao');
  await page.locator('#ajTemp').fill('0.7');
  await page.fill('#ajLimite', '50');
  await page.fill('#ajPersona', 'Você é Teo. Persona de teste.');
  await page.click('#closeSettings');
  await perguntar(page, 'Resolva 3x + 7 = 25');
  await expect(page.locator('.quadro-linhas li.resposta')).toBeVisible({ timeout: 15_000 });
  const corpo = pedidos[0];
  expect(corpo.generationConfig.temperature).toBe(0.7);
  expect(corpo.systemInstruction.parts[0].text).toContain('Persona de teste.');
  expect(corpo.systemInstruction.parts[0].text).toContain('no máximo 50 palavras');

  await page.click('#gear');
  await page.click('#ajRestaurar');
  await expect(page.locator('#ajTempPadrao')).toBeChecked();
  await expect(page.locator('#ajLimite')).toHaveValue('90');
  const ajustes = await page.evaluate(() => JSON.parse(localStorage.getItem('prof3d_ajustes_personagens')));
  expect(ajustes).toEqual({});
});

test('M5: com vozes Natural do Edge, o modo Automático usa a voz do sistema e escolhe por gênero', async ({ page }) => {
  // Simula a lista de vozes do Edge (o Chromium de teste não tem as vozes Natural).
  await page.addInitScript(() => {
    const falsas = [
      { name: 'Microsoft Daniel - Portuguese (Brazil)', lang: 'pt-BR' },
      { name: 'Microsoft Francisca Online (Natural) - Portuguese (Brazil)', lang: 'pt-BR' },
      { name: 'Microsoft Antonio Online (Natural) - Portuguese (Brazil)', lang: 'pt-BR' },
      { name: 'Microsoft Duarte Online (Natural) - Portuguese (Portugal)', lang: 'pt-PT' },
    ];
    speechSynthesis.getVoices = () => falsas;
  });
  await abrir(page);
  const r = await page.evaluate(() => {
    const { voz, buscarPersonagem } = window.__prof3d;
    const nome = (id) => voz.sistema.vozPara(buscarPersonagem(id).voz).name;
    return {
      temNatural: voz.sistema.temNatural,
      motor: voz.resolverMotor(buscarPersonagem('luma').voz).id,
      luma: nome('luma'), teo: nome('matematico'), rafa: nome('engenheiro'), nina: nome('cientista'),
    };
  });
  expect(r.temNatural).toBe(true);
  expect(r.motor).toBe('webspeech');
  expect(r.luma).toContain('Francisca');
  expect(r.nina).toContain('Francisca');
  expect(r.teo).toContain('Antonio');
  expect(r.rafa).toContain('Antonio');
  await expect(page.locator('#seloVoz')).toHaveText('Voz: Edge Natural');
});
