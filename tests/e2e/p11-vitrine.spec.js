// Fase 5, marco I3: vitrine (atração) e botão "Ouvir voz".
// A vitrine não faz som sozinha, cicla entre os personagens ativos, volta sozinha depois de um tempo parada
// na escolha e é interrompida por toque. "Ouvir voz" toca só o que está em cache e nunca chama rede.
import { test, expect } from '@playwright/test';

const KOKORO = 'http://127.0.0.1:8880';

async function kokoroNoAr() {
  try { return (await fetch(KOKORO + '/v1/audio/voices', { signal: AbortSignal.timeout(3000) })).ok; } catch (e) { return false; }
}

async function abrir(page, viewport, extra = {}) {
  await page.setViewportSize(viewport);
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await page.addInitScript((e) => {
    if (localStorage.getItem('prof3d_teste_vit')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_vit', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    for (const [k, v] of Object.entries(e)) localStorage.setItem('prof3d_' + k, v);
  }, extra);
  await page.goto('/?debug');
  await page.waitForFunction(
    () => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden && !document.getElementById('stage').classList.contains('trocando'),
    null, { timeout: 90_000 },
  );
  return erros;
}

const personagemAtual = (page) => page.evaluate(() => window.__prof3d.personagem.id);

test('I3 vitrine: cicla entre os ativos, sem som, com nome e frase; capturas do ciclo', async ({ page }) => {
  test.setTimeout(240_000);
  const erros = await abrir(page, { width: 1280, height: 720 }, { motor: 'webspeech', vitrine_s: '4' });
  expect(await page.evaluate(() => window.__prof3d.etapa)).toBe('atracao');
  await expect(page.locator('#vitrine')).toBeVisible();
  await expect(page.locator('#vitNome')).toHaveText('Luma');
  await expect(page.locator('#vitFrase')).toHaveText('Me pergunte o que você quiser.');
  await expect(page.locator('#vitPontos li')).toHaveCount(2);
  await expect(page.locator('#vitPontos li[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('#vitrineCta')).toHaveText('Toque para escolher');
  // Nada da escolha aparece na vitrine.
  await expect(page.locator('#selecao')).toBeHidden();
  await page.screenshot({ path: 'relatorios/p11-vitrine-1-luma-paisagem.png' });

  // Cicla: Luma, Teo, Luma.
  await page.waitForFunction(() => window.__prof3d.personagem.id === 'matematico' && !!window.__prof3d.avatar && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await expect(page.locator('#vitNome')).toHaveText('Teo');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'relatorios/p11-vitrine-2-teo-paisagem.png' });
  await page.waitForFunction(() => window.__prof3d.personagem.id === 'luma' && !!window.__prof3d.avatar && document.getElementById('loading').hidden, null, { timeout: 90_000 });

  // Sem som automático: nenhuma fala começou, e o gesto de assinatura saiu do catálogo ("atracao").
  // A pose entra 1,8 s depois de o personagem aparecer; numa máquina ocupada isso demora, então espera.
  await page.waitForFunction(() => window.__prof3d.registroGestos.some((g) => /atracao/.test(g.msg)), null, { timeout: 20_000 });
  const r = await page.evaluate(() => ({ falas: window.__prof3d.voz.registro.filter((e) => e.tipo === 'toca-inicio').length }));
  expect(r.falas, 'a vitrine não pode falar sozinha').toBe(0);
  expect(erros).toEqual([]);
});

test('I3 vitrine em retrato', async ({ page }) => {
  const erros = await abrir(page, { width: 540, height: 960 }, { motor: 'webspeech' });
  await expect(page.locator('#vitrine')).toBeVisible();
  // Os pontos ficam acima do botão e nada se sobrepõe ao pódio (o palco termina onde o texto começa).
  const ordem = await page.evaluate(() => {
    const pontos = document.getElementById('vitPontos').getBoundingClientRect();
    const cta = document.getElementById('vitrineCta').getBoundingClientRect();
    const nome = document.getElementById('vitNome').getBoundingClientRect();
    const palco = document.getElementById('stage').getBoundingClientRect();
    return { pontosAcimaDoBotao: pontos.bottom <= cta.top + 1, nomeAbaixoDoPalco: nome.top >= palco.bottom - 1 };
  });
  expect(ordem.pontosAcimaDoBotao).toBe(true);
  expect(ordem.nomeAbaixoDoPalco).toBe(true);
  await page.screenshot({ path: 'relatorios/p11-vitrine-retrato.png' });
  expect(erros).toEqual([]);
});

test('I3 vitrine: toque leva à escolha; parado na escolha, volta à vitrine', async ({ page }) => {
  test.setTimeout(90_000);
  await abrir(page, { width: 1280, height: 720 }, { motor: 'webspeech', selecao_ocioso_s: '10', vitrine_s: '60' });
  // O campo do operador aceita no mínimo 10 s; o tempo guardado vale direto.
  await page.mouse.click(300, 300);
  expect(await page.evaluate(() => window.__prof3d.etapa)).toBe('selecao');
  await expect(page.locator('#selecao')).toBeVisible();

  // Tocar na escolha adia a volta.
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 200);
  await page.waitForTimeout(6000);
  expect(await page.evaluate(() => window.__prof3d.etapa), 'um toque recente adia a volta à vitrine').toBe('selecao');

  // Parado: volta sozinha.
  await expect.poll(() => page.evaluate(() => window.__prof3d.etapa), { timeout: 20_000 }).toBe('atracao');
  await expect(page.locator('#vitrine')).toBeVisible();

  // O botão da vitrine também leva à escolha (teclado e leitor de tela não precisam de toque no palco).
  await page.focus('#vitrineCta');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__prof3d.etapa)).toBe('selecao');
});

test('I3 vitrine: o tempo de cada personagem é configurável pelo operador', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 }, { motor: 'webspeech' });
  await page.click('#gear');
  await expect(page.locator('#opVitrineTempo')).toHaveValue('10');
  await expect(page.locator('#opSelecaoOcioso')).toHaveValue('60');
  await page.fill('#opVitrineTempo', '2');
  await page.locator('#opVitrineTempo').dispatchEvent('change');
  expect(await page.evaluate(() => localStorage.getItem('prof3d_vitrine_s'))).toBe('3'); // mínimo de 3 s
  await page.fill('#opSelecaoOcioso', '3');
  await page.locator('#opSelecaoOcioso').dispatchEvent('change');
  expect(await page.evaluate(() => localStorage.getItem('prof3d_selecao_ocioso_s'))).toBe('10'); // mínimo de 10 s
});

test('I3 Ouvir voz: toca só o que está em cache e não faz nenhuma chamada de rede', async ({ page }) => {
  test.skip(!(await kokoroNoAr()), 'O servidor Kokoro local está fora do ar: sem ele não há áudio em cache para tocar.');
  test.setTimeout(120_000);
  const erros = await abrir(page, { width: 1280, height: 720 }, { motor: 'kokoro-server' });
  await page.click('#vitrineCta');
  // Antes de o áudio estar pronto, o botão fica desligado e diz o motivo.
  await page.waitForFunction(() => window.__prof3d.voz.frasesProntas >= 1, null, { timeout: 60_000 });
  await expect(page.locator('#selOuvir')).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator('#selOuvirMotivo')).toHaveText('');

  // Daqui em diante, qualquer requisição é prova de chamada. Nenhuma pode sair.
  const pedidos = [];
  page.on('request', (r) => pedidos.push(`${r.method()} ${r.url()}`));
  await page.evaluate(() => { window.__antesRegistro = window.__prof3d.voz.registro.length; });
  await page.click('#selOuvir');
  await page.waitForFunction(() => window.__prof3d.voz.registro.slice(window.__antesRegistro).some((e) => e.tipo === 'turno-fim'), null, { timeout: 30_000 });
  const reg = await page.evaluate(() => window.__prof3d.voz.registro.slice(window.__antesRegistro).map((e) => e.tipo));
  expect(pedidos, `chamadas de rede ao ouvir a voz: ${pedidos.join(', ')}`).toEqual([]);
  expect(reg).toContain('sintese-cache');
  expect(reg).not.toContain('sintese-inicio');
  expect(reg).toContain('toca-inicio');
  expect(erros).toEqual([]);
});

test('I3 Ouvir voz: sem áudio em cache o botão fica desligado e explica por quê', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 }, { motor: 'webspeech' });
  await page.click('#vitrineCta');
  // A voz do sistema fala direto: não existe arquivo para guardar, então não há o que tocar do cache.
  await expect(page.locator('#selOuvir')).toBeDisabled();
  await expect(page.locator('#selOuvirMotivo')).toHaveText('A voz do sistema não guarda áudio');
  // E tocar à força não faz nada: a API recusa em vez de sintetizar.
  const tocou = await page.evaluate(() => window.__prof3d.voz.tocarPronta('Oi! Eu sou a Luma. Esta é a minha voz.', window.__prof3d.personagem.voz));
  expect(tocou).toBe(false);
  expect(await page.evaluate(() => window.__prof3d.voz.registro.filter((e) => e.tipo === 'toca-inicio').length)).toBe(0);
});
