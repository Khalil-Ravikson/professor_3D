// Testes de ponta a ponta. O Gemini é sempre simulado (page.route): nenhuma chamada
// sai para a internet. O Kokoro é o servidor real em 127.0.0.1:8880; se estiver
// fora do ar, os testes de voz são pulados com o motivo.
import { test, expect } from '@playwright/test';

const KOKORO = 'http://127.0.0.1:8880';
const PERSONAGENS = ['luma', 'matematico', 'engenheiro', 'cientista'];

async function kokoroNoAr() {
  try {
    const r = await fetch(KOKORO + '/v1/audio/voices', { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

function sseDe(texto) {
  const pedacos = texto.match(/.{1,12}/gs);
  return pedacos.map((p) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: p }] } }] })}\r\n\r\n`).join('');
}

// Abre o app com ?debug, coleta erros do console e espera o avatar carregar.
async function abrir(page, { chave = '', armazenamento = {} } = {}) {
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await page.addInitScript(({ k, extra }) => {
    localStorage.clear();
    if (k) localStorage.setItem('prof3d_gemini_key', k);
    for (const [c, v] of Object.entries(extra)) localStorage.setItem('prof3d_' + c, v);
  }, { k: chave, extra: armazenamento });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__prof3d && window.__prof3d.avatar, null, { timeout: 60_000 });
  return erros;
}

async function trocarPara(page, id) {
  await page.click(`.card[data-id="${id}"]`);
  await page.waitForFunction((alvo) => {
    const P = window.__prof3d;
    return P.personagem.id === alvo && P.avatar && document.getElementById('loading').hidden;
  }, id, { timeout: 60_000 });
  await page.waitForTimeout(1200); // deixa a GPU refletir a troca antes de medir
}

test('M1: abre, carrega o VRM e o console fica limpo', async ({ page }) => {
  const erros = await abrir(page);
  await expect(page.locator('#erroAvatar')).toBeHidden();
  await expect(page.locator('#stage canvas')).toBeVisible();
  const cena = await page.evaluate(() => window.__prof3d.cena.scene.children.length);
  expect(cena).toBe(5); // 3 luzes + modelo + alvo do olhar
  expect(erros).toEqual([]);
});

test('M2: 4 personagens, 2 voltas, memória estável e sem erro', async ({ page }) => {
  const erros = await abrir(page);
  const disponiveis = await page.evaluate(() => window.__prof3d.disponiveis);
  expect(disponiveis).toEqual(PERSONAGENS);
  const memoria = {};
  for (let volta = 0; volta < 2; volta++) {
    for (const id of PERSONAGENS) {
      await trocarPara(page, id);
      const m = await page.evaluate(() => {
        const { geometries, textures } = window.__prof3d.cena.renderer.info.memory;
        return { geometries, textures, filhos: window.__prof3d.cena.scene.children.length, titulo: document.title };
      });
      expect(m.filhos).toBe(5); // não acumula alvo do olhar nem modelo
      (memoria[id] ||= []).push(`${m.geometries}/${m.textures}`);
    }
  }
  for (const id of PERSONAGENS) expect(memoria[id][1], `memória de ${id}`).toBe(memoria[id][0]);
  expect(erros).toEqual([]);
});

test('M3: fala com Kokoro frase a frase, com síntese adiantada e Parar', async ({ page }) => {
  test.skip(!(await kokoroNoAr()), `Kokoro fora do ar em ${KOKORO}`);
  const resposta = 'O céu parece azul por causa da luz do Sol. A luz branca tem todas as cores. ' +
    'A parte azul se espalha mais no ar. Por isso vemos azul. No fim da tarde o céu fica laranja.';
  await page.route('**/generativelanguage.googleapis.com/**', (rota) =>
    rota.fulfill({ status: 200, contentType: 'text/event-stream', body: sseDe(resposta) }));
  const erros = await abrir(page, { chave: 'chave-de-teste' });
  await page.waitForFunction(() => window.__prof3d.voz.statusServidor.ok === true, null, { timeout: 10_000 });
  await expect(page.locator('#seloVoz')).toHaveText('Voz: Kokoro');

  // Mede o nível do AnalyserNode e os visemas que o avatar recebe (lip sync, M4).
  await page.evaluate(() => {
    const a = window.__prof3d.voz.analisador;
    const d = new Float32Array(a.fftSize);
    const em = () => window.__prof3d.avatar.vrm.expressionManager;
    window.__rms = [];
    window.__boca = [];
    setInterval(() => {
      a.getFloatTimeDomainData(d);
      let s = 0; for (const x of d) s += x * x;
      window.__rms.push([performance.now(), Math.sqrt(s / d.length)]);
      const v = Object.fromEntries(['aa', 'ih', 'ou', 'ee', 'oh'].map((k) => [k, em().getValue(k)]));
      window.__boca.push([performance.now(), v]);
    }, 50);
  });
  expect(await page.evaluate(() => window.__prof3d.boca.modo)).toBe('hibrido');

  await page.fill('#text', 'Por que o céu é azul?');
  await page.click('#form button[type=submit]');
  await expect(page.locator('#answer')).toContainText('No fim da tarde', { timeout: 10_000 });

  // Espera a segunda frase começar a tocar.
  await page.waitForFunction(() => window.__prof3d.voz.registro.some((e) => e.tipo === 'toca-inicio' && e.i === 1), null, { timeout: 60_000 });
  const reg = await page.evaluate(() => window.__prof3d.voz.registro.slice());
  const quando = (tipo, i) => reg.find((e) => e.tipo === tipo && e.i === i)?.t;
  expect(quando('sintese-inicio', 1), 'frase 1 sintetizada enquanto a 0 toca').toBeLessThanOrEqual(quando('toca-fim', 0));
  expect(reg.filter((e) => e.tipo.startsWith('sintese-inicio')).every((e) => e.motor === 'kokoro-server')).toBe(true);
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'speaking');
  const comSom = await page.evaluate(() => window.__rms.filter(([, v]) => v > 0.01).length);
  expect(comSom, 'o analisador precisa ver áudio').toBeGreaterThan(5);
  const boca = await page.evaluate(() => {
    const abertos = window.__boca.map(([, v]) => Math.max(...Object.values(v)));
    const dominantes = new Set(window.__boca.map(([, v]) => {
      const k = Object.keys(v).reduce((a, b) => (v[b] > v[a] ? b : a));
      return v[k] > 0.1 ? k : null;
    }).filter(Boolean));
    return { maxAbertura: Math.max(...abertos), vogais: [...dominantes] };
  });
  expect(boca.maxAbertura, 'a boca abre com o áudio').toBeGreaterThan(0.3);
  expect(boca.vogais.length, `formatos de boca vistos: ${boca.vogais}`).toBeGreaterThanOrEqual(2);

  await page.click('#stop');
  const tParar = await page.evaluate(() => performance.now());
  await page.waitForTimeout(800);
  const depois = await page.evaluate((t) => ({
    emTurno: window.__prof3d.voz.emTurno,
    estado: window.__prof3d.estado,
    parado: window.__prof3d.voz.registro.some((e) => e.tipo === 'parado'),
    somDepois: window.__rms.filter(([tt, v]) => tt > t + 200 && v > 0.01).length,
    bocaDepois: Math.max(...window.__boca.filter(([tt]) => tt > t + 500).map(([, v]) => Math.max(...Object.values(v)))),
  }), tParar);
  expect(depois.bocaDepois, 'a boca fecha depois do Parar').toBeLessThan(0.05);
  delete depois.bocaDepois;
  expect(depois).toEqual({ emTurno: false, estado: 'idle', parado: true, somDepois: 0 });
  await expect(page.locator('#stop')).toBeHidden();
  expect(erros).toEqual([]);
});

test('M4: corpo por VRMA idle, piscada e olhar ativos', async ({ page }) => {
  const erros = await abrir(page);
  const r = await page.evaluate(async () => {
    const av = window.__prof3d.avatar;
    const braco = () => av.vrm.humanoid.getNormalizedBoneNode('leftUpperArm').quaternion.clone();
    const q0 = braco();
    let piscou = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 7000) {
      if (av.vrm.expressionManager.getValue('blink') > 0.5) piscou++;
      await new Promise((ok) => setTimeout(ok, 30));
    }
    return {
      clipes: av.bases,
      acao: av.estadoBase,
      bracoMexeu: q0.angleTo(braco()),
      piscou,
      olhar: !!(av.vrm.lookAt && av.vrm.lookAt.target && av.vrm.lookAt.autoUpdate),
    };
  });
  expect(r.clipes).toContain('idle');
  expect(r.acao).toBe('idle');
  expect(r.bracoMexeu, 'o idle anima os braços').toBeGreaterThan(0.001);
  expect(r.piscou, 'pisca em 7 s').toBeGreaterThan(0);
  expect(r.olhar).toBe(true);
  expect(erros).toEqual([]);
});

test('M3: servidor fora do ar cai para a voz do sistema e avisa', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', (rota) =>
    rota.fulfill({ status: 200, contentType: 'text/event-stream', body: sseDe('Uma frase curta. Outra frase.') }));
  const erros = await abrir(page, { chave: 'chave-de-teste', armazenamento: { url_kokoro: 'http://127.0.0.1:9' } });
  await expect(page.locator('#seloVoz')).toHaveText('Voz do sistema: servidor Kokoro fora do ar', { timeout: 10_000 });
  await page.fill('#text', 'oi');
  await page.click('#form button[type=submit]');
  await page.waitForFunction(() => window.__prof3d.voz.registro.some((e) => e.tipo === 'turno-fim'), null, { timeout: 30_000 });
  const motores = await page.evaluate(() => window.__prof3d.voz.registro.filter((e) => e.tipo === 'sintese-inicio').length);
  expect(motores, 'nenhuma síntese no Kokoro').toBe(0);
  // O erro de rede do fetch para a porta morta é esperado; qualquer outro erro não.
  expect(erros.filter((e) => !/127\.0\.0\.1:9|ERR_CONNECTION_REFUSED|Failed to load resource/.test(e))).toEqual([]);
});
