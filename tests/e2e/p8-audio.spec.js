// P8: controle de volume visível, intervalo constante entre sentenças e redução do
// fundo quando o microfone abre. Motor de voz forçado para a voz do sistema, para o
// teste não depender do servidor Kokoro.
import { test, expect } from '@playwright/test';

const PAUSA_ESPERADA = 180; // src/audio.js, PAUSA_ENTRE_FRASES_MS

async function abrir(page, viewport = { width: 1280, height: 720 }) {
  await page.setViewportSize(viewport);
  // O script roda em toda navegação, inclusive no reload: a marca evita apagar o que
  // o teste de persistência acabou de gravar.
  await page.addInitScript(() => {
    if (localStorage.getItem('prof3d_teste_p8')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_p8', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
  });
  await page.goto('/?debug');
  // Espera o fim da partida, não só o avatar: o resto do início ainda mexe no estado.
  await page.waitForFunction(
    () => !!(window.__prof3d && window.__prof3d.avatar) && !/Preparando/.test(document.getElementById('status').textContent),
    null, { timeout: 90_000 },
  );
  await page.evaluate(() => window.__prof3d.irParaConversa('nao')); // a vitrine é muda e esconde o volume
}

test('P8 controle de volume: visível, muda o ganho e lembra depois de recarregar', async ({ page }) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrir(page);

  await expect(page.locator('#volume')).toBeVisible();
  await expect(page.locator('#volSlider')).toBeVisible();
  await expect(page.locator('#volMudo')).toBeVisible();
  // Alvo de toque grande o bastante para o quiosque.
  const caixa = await page.locator('#volMudo').boundingBox();
  expect(caixa.width).toBeGreaterThanOrEqual(32);
  expect(caixa.height).toBeGreaterThanOrEqual(32);

  // Padrão: 80 por cento, ganho pela curva ao quadrado.
  expect(await page.evaluate(() => window.__prof3d.mesa.volume)).toBeCloseTo(0.8, 5);
  expect(await page.evaluate(() => window.__prof3d.mesa.ganhoAlvo)).toBeCloseTo(0.64, 2);

  await page.locator('#volSlider').fill('40');
  await page.locator('#volSlider').dispatchEvent('input');
  expect(await page.evaluate(() => window.__prof3d.mesa.volume)).toBeCloseTo(0.4, 5);
  expect(await page.evaluate(() => window.__prof3d.mesa.ganhoAlvo)).toBeCloseTo(0.16, 2);
  await expect(page.locator('#volValor')).toHaveText('40%');

  // Mudo: ganho zero, mas o volume escolhido continua guardado.
  await page.click('#volMudo');
  expect(await page.evaluate(() => window.__prof3d.mesa.mudo)).toBe(true);
  await page.waitForFunction(() => window.__prof3d.voz.saida.gain.value === 0, null, { timeout: 2000 });
  expect(await page.evaluate(() => window.__prof3d.mesa.volume)).toBeCloseTo(0.4, 5);
  await expect(page.locator('#volMudo')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#volValor')).toHaveText('sem som');
  await page.screenshot({ path: 'relatorios/p8-volume-mudo.png' });

  // Recarrega: volta no mesmo lugar.
  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.mesa), null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao')); // o reload volta para a vitrine, que esconde o volume
  expect(await page.evaluate(() => window.__prof3d.mesa.volume)).toBeCloseTo(0.4, 5);
  expect(await page.evaluate(() => window.__prof3d.mesa.mudo)).toBe(true);

  // Mexer no controle tira do mudo.
  await page.locator('#volSlider').fill('70');
  await page.locator('#volSlider').dispatchEvent('input');
  expect(await page.evaluate(() => window.__prof3d.mesa.mudo)).toBe(false);
  await page.screenshot({ path: 'relatorios/p8-volume.png' });
  expect(erros).toEqual([]);
});

test('P8 fundo abaixado enquanto o microfone está aberto', async ({ page }) => {
  await abrir(page);
  const ganho = () => page.evaluate(() => window.__prof3d.voz.saida.gain.value);
  const antes = await ganho();

  await page.evaluate(() => window.__prof3d.definirEstado('listening'));
  expect(await page.evaluate(() => window.__prof3d.mesa.fundoAbaixado)).toBe(true);
  // A rampa é de 60 ms; espera o ganho chegar perto do alvo.
  await page.waitForFunction(() => window.__prof3d.voz.saida.gain.value < 0.4, null, { timeout: 2000 });
  expect(await ganho()).toBeLessThan(antes);

  await page.evaluate(() => window.__prof3d.definirEstado('idle'));
  expect(await page.evaluate(() => window.__prof3d.mesa.fundoAbaixado)).toBe(false);
  await page.waitForFunction((a) => Math.abs(window.__prof3d.voz.saida.gain.value - a) < 0.05, antes, { timeout: 2000 });
});

test('P8 intervalo entre sentenças é curto e constante', async ({ page }) => {
  await abrir(page);
  // Quatro sentenças pela voz do sistema. Em navegador sem voz instalada o motor
  // resolve na hora, e o que sobra medido é exatamente o intervalo do app.
  await page.evaluate(() => {
    const p = window.__prof3d.personagem;
    window.__prof3d.voz.falarTexto('Primeira frase. Segunda frase. Terceira frase. Quarta frase.', p.voz);
  });
  await page.waitForFunction(() => window.__prof3d.voz.registro.some((r) => r.tipo === 'turno-fim'), null, { timeout: 30_000 });

  const intervalos = await page.evaluate(() => {
    const reg = window.__prof3d.voz.registro;
    const fins = reg.filter((r) => r.tipo === 'toca-fim');
    const inicios = reg.filter((r) => r.tipo === 'toca-inicio');
    const v = [];
    for (let i = 0; i + 1 < inicios.length; i++) {
      const fim = fins.find((f) => f.i === inicios[i].i);
      if (fim) v.push(inicios[i + 1].t - fim.t);
    }
    return v;
  });

  expect(intervalos.length).toBeGreaterThanOrEqual(2);
  for (const ms of intervalos) {
    expect(ms).toBeGreaterThanOrEqual(PAUSA_ESPERADA - 30);
    expect(ms).toBeLessThanOrEqual(PAUSA_ESPERADA + 150);
  }
  // Constante: a diferença entre o maior e o menor fica dentro de um quadro de folga.
  expect(Math.max(...intervalos) - Math.min(...intervalos)).toBeLessThanOrEqual(80);
  console.log('intervalos medidos (ms):', intervalos.join(', '));
});

test('P8 parar no meio não espera o intervalo', async ({ page }) => {
  await abrir(page);
  const t = await page.evaluate(async () => {
    const p = window.__prof3d.personagem;
    window.__prof3d.voz.falarTexto('Uma. Duas. Três. Quatro. Cinco.', p.voz);
    await new Promise((r) => setTimeout(r, 60));
    const ini = performance.now();
    window.__prof3d.voz.parar();
    // Depois de parar(), nenhum turno fica vivo.
    await new Promise((r) => setTimeout(r, 30));
    return { ms: performance.now() - ini, emTurno: window.__prof3d.voz.emTurno };
  });
  expect(t.emTurno).toBe(false);
  expect(t.ms).toBeLessThan(200);
});
